const bcrypt = require('bcryptjs');
const db = require('./db');

const args = process.argv.slice(2);
const newUsername = args[0];
const newPassword = args[1];

if (!newUsername || !newPassword) {
  console.log('Uso: node change_superadmin.js <novo_usuario> <nova_senha>');
  process.exit(1);
}

const salt = bcrypt.genSaltSync(10);
const hashedPassword = bcrypt.hashSync(newPassword, salt);

db.run(
  "UPDATE users SET username = ?, password = ? WHERE role = 'superadmin'",
  [newUsername, hashedPassword],
  function(err) {
    if (err) {
      console.error('Erro ao atualizar o SuperAdmin:', err.message);
      process.exit(1);
    }
    
    // this.changes indica o número de linhas afetadas
    console.log(`Sucesso! SuperAdmin atualizado.`);
    console.log(`Novo usuário: ${newUsername}`);
    console.log(`Nova senha: ${newPassword}`);
    process.exit(0);
  }
);
