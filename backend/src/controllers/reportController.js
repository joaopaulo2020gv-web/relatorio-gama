const db = require('../database/db');

// Criar novo relatório
exports.createReport = (req, res) => {
  const pilotId = req.user.id;
  const companyId = req.user.company_id;

  if (!companyId) {
    return res.status(400).json({ error: 'Você precisa estar associado a uma empresa para criar relatórios.' });
  }

  const {
    client_name,
    farm_name,
    client_email,
    culture,
    report_date,
    flights_data,
    weather_temp,
    weather_humidity,
    weather_desc,
    delta_t,
    caldas_data,
    ph_photo_url,
    ph_desc,
    maps_data,
    observations,
    total_area,
    price_per_ha,
    total_price
  } = req.body;

  if (!client_name || !farm_name || !culture || !report_date) {
    return res.status(400).json({ error: 'Cliente, fazenda, cultura e data são campos obrigatórios.' });
  }

  db.run(
    `INSERT INTO reports (
      pilot_id, company_id, client_name, farm_name, client_email, culture, report_date,
      flights_data, weather_temp, weather_humidity, weather_desc, delta_t,
      caldas_data, ph_photo_url, ph_desc, maps_data, observations,
      total_area, price_per_ha, total_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pilotId,
      companyId,
      client_name,
      farm_name,
      client_email || null,
      culture,
      report_date,
      JSON.stringify(flights_data || []),
      weather_temp || 0,
      weather_humidity || 0,
      weather_desc || '',
      delta_t || 0,
      JSON.stringify(caldas_data || []),
      ph_photo_url || '',
      ph_desc || '',
      JSON.stringify(maps_data || []),
      observations || '',
      total_area || 0,
      price_per_ha || 0,
      total_price || 0
    ],
    function(err) {
      if (err) {
        console.error('Erro ao salvar relatório:', err.message);
        return res.status(500).json({ error: 'Erro ao salvar o relatório.' });
      }
      return res.status(201).json({
        message: 'Relatório criado com sucesso!',
        report_id: this.lastID
      });
    }
  );
};

// Listar relatórios filtrados por cargo (SuperAdmin: tudo, Admin: empresa, Piloto: seus relatórios)
exports.listReports = (req, res) => {
  const { role, company_id, id: userId } = req.user;

  let query = '';
  let params = [];

  if (role === 'superadmin') {
    query = `
      SELECT r.id, r.client_name, r.farm_name, r.report_date, r.total_area, r.total_price,
             u.name as pilot_name, c.name as company_name 
      FROM reports r 
      JOIN users u ON r.pilot_id = u.id 
      JOIN companies c ON r.company_id = c.id
      ORDER BY r.created_at DESC
    `;
  } else if (role === 'admin') {
    query = `
      SELECT r.id, r.client_name, r.farm_name, r.report_date, r.total_area, r.total_price,
             u.name as pilot_name 
      FROM reports r 
      JOIN users u ON r.pilot_id = u.id 
      WHERE r.company_id = ?
      ORDER BY r.created_at DESC
    `;
    params = [company_id];
  } else {
    // Piloto
    query = `
      SELECT r.id, r.client_name, r.farm_name, r.report_date, r.total_area, r.total_price
      FROM reports r
      WHERE r.pilot_id = ?
      ORDER BY r.created_at DESC
    `;
    params = [userId];
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao buscar relatórios.' });
    }
    return res.json({ reports: rows });
  });
};

// Obter relatório detalhado por ID (incluindo dados do piloto e empresa)
exports.getReportById = (req, res) => {
  const { id } = req.params;
  const { role, company_id, id: userId } = req.user;

  db.get(
    `SELECT r.*, u.name as pilot_name, 
            c.name as company_name, c.cnpj as company_cnpj, c.logo_url as company_logo_url,
            c.bank_name, c.bank_agency, c.bank_account, c.bank_owner, c.bank_cpf_pix
     FROM reports r
     JOIN users u ON r.pilot_id = u.id
     JOIN companies c ON r.company_id = c.id
     WHERE r.id = ?`,
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao buscar relatório.' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Relatório não encontrado.' });
      }

      // Validar acesso (o piloto só vê o dele, o admin da empresa vê todos da empresa)
      if (role === 'pilot' && row.pilot_id !== userId) {
        return res.status(403).json({ error: 'Você não tem permissão para visualizar este relatório.' });
      }
      if (role === 'admin' && row.company_id !== company_id) {
        return res.status(403).json({ error: 'Este relatório pertence a outra empresa.' });
      }

      // Desserializar JSON strings
      try {
        row.flights_data = JSON.parse(row.flights_data);
        row.caldas_data = JSON.parse(row.caldas_data);
        row.maps_data = JSON.parse(row.maps_data);
      } catch (e) {
        console.error('Erro ao fazer parse nos dados do relatório:', e);
      }

      return res.json({ report: row });
    }
  );
};

// Excluir relatório
exports.deleteReport = (req, res) => {
  const { id } = req.params;
  const { role, company_id, id: userId } = req.user;

  db.get("SELECT pilot_id, company_id FROM reports WHERE id = ?", [id], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Relatório não encontrado.' });
    }

    // Regras de exclusão
    if (role === 'pilot' && row.pilot_id !== userId) {
      return res.status(403).json({ error: 'Você só pode excluir seus próprios relatórios.' });
    }
    if (role === 'admin' && row.company_id !== company_id) {
      return res.status(403).json({ error: 'Você não pode excluir relatórios de outra empresa.' });
    }

    db.run("DELETE FROM reports WHERE id = ?", [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao excluir relatório.' });
      }
      return res.json({ message: 'Relatório excluído com sucesso!' });
    });
  });
};

// Lógica de Upload de Imagem individual (salva no disco local)
exports.uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    // O multer diskStorage já salvou o arquivo, basta retornar a URL
    const fileUrl = `/api/uploads/${req.file.filename}`;
    return res.json({ url: fileUrl });
  } catch (err) {
    console.error('Erro ao processar upload da imagem:', err);
    return res.status(500).json({ error: 'Erro ao fazer upload da imagem.' });
  }
};
