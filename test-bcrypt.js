const bcrypt = require("bcryptjs");

const hash = "$2a$12$uEKbk.hVOi4j58xVgXnlouYWCIOPLeSSE7LHdkWNFqKspvvE4bW4q";

// Cambia aquí la contraseña que quieres probar
const password = "123456";

bcrypt.compare(password, hash).then((isValid) => {
  console.log("¿La contraseña coincide?:", isValid);
});