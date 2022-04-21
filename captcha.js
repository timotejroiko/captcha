"use strict";

const Discord = require("discord.js-light");
const client = new Discord.Client({
	ws: { intents: 1 + 2 + 512 },
	shards: "auto",
	cacheRoles: true,
	cacheOverwrites: true,
	disableMentions: "everyone",
	presence: {
		activity: {
			name: "@captcha help",
			type: "LISTENING"
		}
	}
});
const db = require("./db");
const generate = require("./generate");
const commands = require("./commands");
client.on("ready", () => {
	client.logger({ message: "Logged in" });
});

const autokicks = {};

client.on("message", async m => {
	if(m.author.bot) { return; }
	if(m.type !== "DEFAULT") { return; }
	if(!m.content) { return; }
	if(!m.guild) { return; }
	if(m.content.startsWith("<@580578395411185664>") || m.content.startsWith("<@!580578395411185664>")) {
		const array = m.content.split(/\s+/);
		const command = commands.get((array[1] || "").toLowerCase());
		if(command) {
			client.logger({
				guild: m.guild.name,
				channel: m.channel.id,
				message: `${array[1].toLowerCase()} command run by ${m.author.tag}`
			});
			command(m, db).catch(e => client.logger(e, "error"));
		}
	} else if(db.channelCache.has(m.channel.id)) {
		const config = db.dbGet("guilds", m.guild.id);
		if(!config.enabled) { return; }
		let channel = client.channels.cache.get(config.channel);
		if(!channel) {
			try {
				channel = await client.channels.fetch(config.channel);
			} catch(e) {
				client.logger(e, "error");
				return;
			}
		}
		if(!m.member) {
			client.logger({
				guild: m.guild.name,
				channel: channel.id,
				message: `missing member for ${m.author.tag} (${m.author.id})`
			});
			console.log(m);
			return;
		}
		if(db.pendingCache.has(m.member.id)) {
			client.logger({
				guild: m.guild.name,
				channel: channel.name,
				message: `[attempt] ${m.member.displayName}: ${m.content}`
			});
			const pending = db.dbGet("pending", m.member.id);
			if(!config.expire || Date.now() - pending.timestamp < config.expire * 60000) {
				const s = config.sensitive;
				if((s ? m.content : m.content.toUpperCase()) === (s ? pending.code : pending.code.toUpperCase())) {
					clearTimeout(autokicks[m.member.id]);
					delete autokicks[m.member.id];
					db.dbDelete("pending", m.member.id);
					client.logger({
						guild: m.guild.name,
						channel: channel.name,
						message: `Captcha solved by ${m.author.username}`
					});
					db.incrStats("solved");
					try {
						await m.member.roles.add(config.role);
					} catch(e) {
						await channel.send(`Failed to assign the verified role due to: ${e.message}, please assign it manually`);
						client.logger(e, "error");
						// db.prepare(`UPDATE guilds SET enabled = 0 WHERE id = ${m.guild.id}`).run();
						return;
					}
				}
			} else {
				const captcha = generate(config.strength);
				try {
					await channel.send(config.expire_message === "disabled" ? "" : config.expire_message, { files: [new Discord.MessageAttachment(captcha.image, "captcha.jpg")] });
				} catch(e) {
					client.logger(e, "error");
					await channel.send("Unable to attach the captcha image, check permissions");
					// db.prepare(`UPDATE guilds SET enabled = 0 WHERE id = ${m.guild.id}`).run();
					return;
				}
				db.dbSet("pending", {
					id: m.member.id,
					guild: m.guild.id,
					code: captcha.solution,
					timestamp: Date.now()
				});
				client.logger({
					guild: m.guild.name,
					channel: channel.name,
					message: `Captcha regenerated for ${m.author.username}`
				});
				db.incrStats("created");
			}
		} else if(!m.member.hasPermission("ADMINISTRATOR") && !m.member.roles.cache.has(config.role)) {
			const captcha = generate(config.strength);
			try {
				await channel.send(config.expire_message === "disabled" ? "" : config.expire_message, { files: [new Discord.MessageAttachment(captcha.image, "captcha.jpg")] });
			} catch(e) {
				client.logger(e, "error");
				await channel.send("Unable to attach the captcha image, check permissions");
				// db.prepare(`UPDATE guilds SET enabled = 0 WHERE id = ${m.guild.id}`).run();
				return;
			}
			db.dbSet("pending", {
				id: m.member.id,
				guild: m.guild.id,
				code: captcha.solution,
				timestamp: Date.now()
			});
			client.logger({
				guild: m.guild.name,
				channel: channel.name,
				message: `Captcha regenerated for ${m.author.username}`
			});
			db.incrStats("created");
		}
	}
});

client.on("guildMemberAdd", async member => {
	if(!member.user.bot && db.guildsCache.has(member.guild.id)) {
		await new Promise(r => { setTimeout(r, 1000); });
		const config = db.dbGet("guilds", member.guild.id);
		if(!config.enabled) { return; }
		let channel;
		try {
			channel = client.channels.cache.get(config.channel) || await client.channels.fetch(config.channel);
		} catch(e) {
			client.logger(e, "error");
			return;
		}
		const captcha = generate(config.strength);
		const msg = config.message === "disabled" ? "" : config.message.replace("%USER%", `<@${member.id}>`).replace("%NAME%", member.user.username).replace("%GUILD%", member.guild.name);
		try {
			await channel.send(msg, { files: [new Discord.MessageAttachment(captcha.image, "captcha.jpg")] });
		} catch(e) {
			client.logger(e, "error");
			channel.send("Unable to attach the captcha image, check permissions").catch(f => client.logger(f, "error"));
			// db.prepare(`UPDATE guilds SET enabled = 0 WHERE id = ${member.guild.id}`).run();
			return;
		}
		db.dbSet("pending", {
			id: member.id,
			guild: member.guild.id,
			code: captcha.solution,
			timestamp: Date.now()
		});
		client.logger({
			guild: member.guild.name,
			channel: member.guild.channels.cache.get(config.channel).name,
			message: `Captcha created for ${member.user.username} (${captcha.solution})`
		});
		db.incrStats("created");
		if(config.autokick) {
			autokicks[member.id] = setTimeout(async () => {
				try {
					if(!member.roles.cache.has(config.role)) {
						await member.kick();
						client.logger({
							guild: member.guild.name,
							message: `autokicked ${member.id}`
						});
					}
				} catch {
					channel.send("Unable to kick unverified members. check permissions").catch(e => client.logger(e, "error"));
				}
				clearTimeout(autokicks[member.id]);
				delete autokicks[member.id];
			}, config.expire * 60000);
		}
	}
});

client.on("guildMemberRemove", member => {
	if(db.pendingCache.has(member.id)) {
		db.dbDelete("pending", member.id);
		client.logger({
			guild: member.guild.name,
			message: `Captcha removed for ${member.user.username} (left guild)`
		});
	}
});

client.on("guildMemberUpdate", (_, member) => {
	const config = db.dbGet("guilds", member.guild.id);
	if(!config) { return; }
	if(db.pendingCache.has(member.id) && member.roles.cache.has(config.role)) {
		db.dbDelete("pending", member.id);
		client.logger({
			guild: member.guild.name,
			message: `Captcha removed for ${member.user.username} (manually assigned role)`
		});
	}
});

client.logger = (e, type) => {
	if(type === "error") {
		if(e.path) {
			const name = e.name || "?";
			const msg = e.message || "??";
			const channel = client.channels.cache.get((e.path || "").split("/")[2]) || null;
			const guild = channel ? channel.guild : null;
			let c = `${name}: ${msg}`;
			if(guild) { c += ` in [${guild.name}]`; }
			if(channel) { c += ` -> #${channel.name}`; }
			console.log(c);
		} else {
			console.log(`${e}`, e);
		}
	} else {
		let c = "";
		if(e.guild) { c += `[${e.guild}]`; }
		if(e.channel) { c += ` #${e.channel}`; }
		c += ` -> ${e.message}`;
		console.log(c);
		if(e instanceof Error) { console.log(e); }
	}
};

client.on("error", e => client.logger(e, "error"));

client.login(process.env.DISCORD_TOKEN).catch(console.error);
