const bcrypt = require("bcryptjs");

const password = "mariano23";
const hash = bcrypt.hashSync(password, 10);

console.log(hash);