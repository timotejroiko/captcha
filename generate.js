"use strict";

const { createCanvas } = require("canvas");

module.exports = function(_chars) {
	let chars = _chars;
	if(chars < 1 || chars > 10) { chars = 5; }
	const c = createCanvas(50 + (chars * 50), 100);
	const ctx = c.getContext("2d");
	const sect = (c.width - 50) / chars;
	let solve = "";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = `rgb(${randomInt(200, 255)},${randomInt(200, 255)},${randomInt(200, 255)})`;
	ctx.fillRect(0, 0, c.width, c.height);
	for(let i = 0; i < chars; i++) {
		const char = randomChar();
		const font = 25 + Math.floor(Math.random() * 25);
		const h = font / 2;
		const posX = h + randomInt(sect * i, (sect * (i + 1)) - h);
		const posY = h + Math.floor(Math.random() * (c.height - font));
		ctx.font = `italic bold ${font}px Arial`;
		ctx.fillStyle = `rgb(${randomInt(0, 200)},${randomInt(0, 200)},${randomInt(0, 200)})`;
		ctx.strokeStyle = `rgb(${randomInt(0, 200)},${randomInt(0, 200)},${randomInt(0, 200)})`;
		ctx.lineWidth = 2;
		ctx.fillText(char, posX, posY);
		ctx.moveTo(randomInt(0, c.width), randomInt(0, c.height));
		ctx.lineTo(randomInt(0, c.width), randomInt(0, c.height));
		ctx.stroke();
		solve += char;
	}
	return {
		solution: solve,
		image: c.toBuffer("image/jpeg")
	};
};

function randomChar() {
	const chars = "123456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ@#$%&?";
	return chars[Math.floor(Math.random() * chars.length)];
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1) ) + min;
}
