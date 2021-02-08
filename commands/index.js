"use strict";

const fs = require("fs");

module.exports = new Map();

fs.readdirSync(`${process.cwd()}/commands`).forEach(file => {
	if(file === "index.js") { return; }
	module.exports.set(file.split(".")[0], require(`./${file}`));
});
