const { Client } = require('ssh2');
const conn = new Client();

const config = {
  host: '2.25.172.44',
  port: 22,
  username: 'root',
  password: '@Jp123Gd45678', // Tentando usar a mesma senha padrão ou SSH Key
  tryKeyboardInteractive: true
};

const command = process.argv.slice(2).join(' ');

if (!command) {
  console.error('❌ Por favor, informe o comando a ser executado!');
  process.exit(1);
}

conn.on('ready', () => {
  console.log(`⚡ Conectado à VPS Hostinger (2.25.172.44)! Executando: "${command}"...\n`);
  
  conn.exec(command, (err, stream) => {
    if (err) {
      console.error('❌ Erro ao executar comando:', err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log(`\n✅ Comando encerrado com código: ${code}`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
  finish(['@Jp123Gd45678']);
}).on('error', (err) => {
  console.error('❌ Erro de conexão SSH:', err);
}).connect(config);
