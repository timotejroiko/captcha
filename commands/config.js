"use strict";

module.exports = async (m, db) => {
	if(!m.member.hasPermission("ADMINISTRATOR")) { return m.channel.send("You must be a Guild Admin to setup captcha"); }
	if(!m.guild.available) { return m.channel.send("Guild unavailable, is discord having issues?"); }
	const config = db.dbGet("guilds", m.guild.id);
	if(!config) { return m.channel.send("No configuration found for this guild"); }
	const channel = await m.client.channels.fetch(config.channel, false).catch(() => ({ id: config.channel }));
	await m.channel.send({
		embed: {
			title: "Config",
			description: "The following configuration was found for this guild, select the fields you wish to edit.",
			fields: [
				{
					name: "[1] Gateway Channel",
					value: `**#${channel.name || "?"}** (${channel.id})`
				},
				{
					name: "[2] Verified Role",
					value: `**${(m.guild.roles.cache.get(config.role) || {}).name || "role not found"}** (${config.role})`
				},
				{
					name: "[3] Welcome Message",
					value: config.message.length > 1000 ? `${config.message.substr(0, 1000)}...` : config.message
				},
				{
					name: "[4] Captcha Length",
					value: `**${config.strength}**`
				},
				{
					name: "[5] Case Sensitive",
					value: `**${config.sensitive ? "Yes" : "No"}**`
				},
				{
					name: "[6] Captcha Expires",
					value: `**Expires after ${config.expire} minutes**`
				},
				{
					name: "[7] Expired Captcha Message",
					value: config.expire_message.length > 1000 ? `${config.expire_message.substr(0, 1000)}...` : config.expire_message
				},
				{
					name: "[8] Auto kick",
					value: `**${config.autokick ? "Enabled" : "Disabled"}**`
				},
				{
					name: "[9] Captcha Status",
					value: `**${config.enabled ? "Enabled" : "Disabled"}**`
				},
				{
					name: "[10] Cancel",
					value: "Exit this menu"
				}
			]
		}
	});
	const reply = await m.channel.awaitMessages(r => r.author.id === m.author.id && ["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(r.content), {
		max: 1,
		time: 60000
	});
	if(!reply.size) { return m.channel.send("setup timed out"); }
	switch(reply.first().content) {
		case "1": {
			if(!m.guild.me.hasPermission("MANAGE_CHANNELS")) { return m.channel.send("The MANAGE CHANNELS permission is required during setup. It can be safely disabled after the setup is completed"); }
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Select a new gateway channel",
							value: "Mention the channel you wish to use as an entry point to this guild. Its permissions will be modified and **the previous channel will be deleted**. To cancel type `cancel`\nExample:```#noobs-start-here```"
						}
					]
				}
			});
			const msgs = await m.channel.awaitMessages(async w => {
				if(w.author.id === m.author.id) {
					if(w.content.toUpperCase() === "CANCEL") { return true; }
					if(m.mentions.channels.first() && await m.client.channels.fetch(m.mentions.channels.first().id, false).catch(() => null)) {
						return true;
					}
					m.channel.send("channel not found or invalid, try again");

				}
			}, {
				max: 1,
				time: 60000
			});
			if(!msgs.size) { return m.channel.send("setup timed out"); }
			if(msgs.first().content.toUpperCase() === "CANCEL") { return m.channel.send("Canceled"); }
			const vChannel = m.mentions.channels.first();
			if(vChannel.id === config.channel) { return m.channel.send("This channel is already the current gateway channel"); }
			try {
				await vChannel.overwritePermissions([{
					id: m.guild.id,
					allow: 3072
				}, {
					id: config.role,
					deny: 1024
				}, {
					id: m.guild.me.id,
					allow: 52224
				}]);
				db.prepare("UPDATE guilds SET channel = ? WHERE id = ?").run(vChannel.id, m.guild.id);
				db.channelCache.delete(config.channel);
				db.channelCache.add(vChannel.id);
			} catch(e) {
				m.client.logger(e, "error");
				return m.channel.send(`failed to update configuration due to: ${e.toString()}`);
			}
			try {
				await m.guild.channels.forge(config.channel, "text").delete();
			} catch(e) {
				await m.channel.send("failed to delete old gateway channel, please delete it manually");
			}
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Gateway channel updated",
							value: `The new gateway channel is **#${vChannel.name}**`
						}
					]
				}
			});
			break;
		}
		case "2": {
			if(!m.guild.me.hasPermission("MANAGE_ROLES")) { return m.channel.send("The MANAGE ROLES permission is required for Captcha to function"); }
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Select a role to assign",
							value: "Type the name, ID or mention the role you wish to give people who solve the captcha. Its permissions will be modified and **the previous role will be deleted**. To cancel type `cancel`\nExample:```verified```"
						}
					]
				}
			});
			const role = await m.channel.awaitMessages(w => {
				if(w.author.id === m.author.id) {
					if(w.content.toUpperCase() === "CANCEL") { return true; }
					const f = m.guild.roles.cache.filter(r => r.name.toUpperCase() === w.content.toUpperCase() || r.id === w.content.replace(/\D+/g, ""));
					if(f.size === 1) {
						if(f.first().editable) {
							return true;
						}
						m.channel.send("role found but not accessible, do i have enough permissions to use it?");

					} else if(!f.size) { m.channel.send("role not found"); }
					else { m.channel.send("found multiple roles with the same name, please give it a unique name or use a role ID instead"); }
				}
			}, {
				max: 1,
				time: 60000
			});
			if(!role.size) { return m.channel.send("setup timed out"); }
			if(role.first().content.toUpperCase() === "CANCEL") { return m.channel.send("Canceled"); }
			const vRole = m.guild.roles.cache.get(role.first().content.replace(/\D+/g, "")) || m.guild.roles.cache.find(r => r.name.toUpperCase() === role.first().content.toUpperCase());
			try {
				await vRole.setPermissions(m.guild.me.permissions.bitfield & 104189504);
				db.prepare("UPDATE guilds SET role = ? WHERE id = ?").run(vRole.id, m.guild.id);
			} catch(e) {
				m.client.logger(e, "error");
				return m.channel.send(`failed to update configuration due to: ${e.toString()}`);
			}
			try { await m.guild.roles.cache.get(config.role).delete(); } catch(e) { await m.channel.send("failed to delete role, please delete it manually"); }
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Verified role updated",
							value: `The new verified role is **${vRole.name}**`
						}
					]
				}
			});
			break;
		}
		case "3": {
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Create a welcome message",
							value: "Type a welcome message below. You can use the following placeholders:\n\n**%USER%** - Mention the new member\n**%NAME%** - The new member's username\n**%GUILD%** - The guild's name\n\nTo disable welcome messages type `disable`\nTo cancel type `cancel`\nExample:```Welcome to %GUILD% my dear %USER%! solve the captcha below to gain access to our channels.```"
						}
					]
				}
			});
			const welcome = await m.channel.awaitMessages(w => w.author.id === m.author.id, {
				max: 1,
				time: 120000
			});
			if(!welcome.size) { return m.channel.send("setup timed out"); }
			if(welcome.first().content.toUpperCase() === "DISABLE") { welcome.first().content = "disabled"; }
			if(welcome.first().content.toUpperCase() === "CANCEL") { return m.channel.send("Canceled"); }
			try {
				db.prepare("UPDATE guilds SET message = ? WHERE id = ?").run(welcome.first().content, m.guild.id);
			} catch(e) {
				m.client.logger(e, "error");
				return m.channel.send(`failed to update configuration due to: ${e.toString()}`);
			}
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Welcome message updated",
							value: `The new welcome message is:\n\n${welcome.first().content.length > 1000 ? `${welcome.first().content.substr(0, 1000)}...` : welcome.first().content}`
						}
					]
				}
			});
			break;
		}
		case "4": {
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Configure Captcha Length",
							value: "Enter the desired amount of characters in the captcha. Min 2, max 10. To cancel type `cancel`"
						}
					]
				}
			});
			const length = await m.channel.awaitMessages(w => {
				if(w.author.id === m.author.id) {
					if(w.content.toUpperCase() === "CANCEL") { return true; }
					if(!isNaN(w.content) && w.content >= 2 && w.content <= 10) {
						return true;
					}
					m.channel.send("Invalid captcha length. Please type a number between 2 and 10");

				}
			}, {
				max: 1,
				time: 60000
			});
			if(!length.size) { return m.channel.send("setup timed out"); }
			if(length.first().content.toUpperCase() === "CANCEL") { return m.channel.send("Canceled"); }
			try {
				db.prepare("UPDATE guilds SET strength = ? WHERE id = ?").run(parseInt(length.first().content), m.guild.id);
			} catch(e) {
				m.client.logger(e, "error");
				return m.channel.send(`failed to update configuration due to: ${e.toString()}`);
			}
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Captcha length updated",
							value: `The new captcha length is **${parseInt(length.first().content)}**`
						}
					]
				}
			});
			break;
		}
		case "5": {
			await m.channel.send({
				embed: {
					title: "Config",
					description: "Configure Captcha case sensitivity",
					fields: [
						{
							name: "[1] Enable case sensitivity",
							value: "This option enables case sensitivity, ie: `ijOWe` can only be solved with exactly `ijOWe`"
						},
						{
							name: "[2] Disable case sensitivity",
							value: "This option disables case sensitivity, ie: `ijOWe` can be solved with `ijowe` or `IJOWE` or any case combination"
						},
						{
							name: "[3] Cancel",
							value: "Exit this menu"
						}
					]
				}
			});
			const sense = await m.channel.awaitMessages(w => w.author.id === m.author.id && ["1", "2", "3"].includes(w.content), {
				max: 1,
				time: 60000
			});
			if(!sense.size) { return m.channel.send("setup timed out"); }
			if(sense.first().content === "3") { return m.channel.send("canceled"); }
			try {
				db.prepare("UPDATE guilds SET sensitive = ? WHERE id = ?").run(sense.first().content === "1" ? 1 : 0, m.guild.id);
			} catch(e) {
				m.client.logger(e, "error");
				return m.channel.send(`failed to update configuration due to: ${e.toString()}`);
			}
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Captcha case sensitivity updated",
							value: `Captcha case sensitivity is now **${sense.first().content === "1" ? "Yes" : "No"}**`
						}
					]
				}
			});
			break;
		}
		case "6": {
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Set Captcha expiration time",
							value: "Type a number of minutes after which a captcha should expire. When a user attempts to solve an expired captcha, a new captcha will be generated. Min 1, Max 10080. To cancel type `cancel`"
						}
					]
				}
			});
			const minutes = await m.channel.awaitMessages(w => {
				if(w.author.id === m.author.id) {
					if(w.content.toUpperCase() === "CANCEL") { return true; }
					if(!isNaN(w.content) && w.content >= 1 && w.content <= 10080) {
						return true;
					}
					m.channel.send("Invalid number of minutes. Please type a number between 1 and 10080");

				}
			}, {
				max: 1,
				time: 60000
			});
			if(!minutes.size) { return m.channel.send("setup timed out"); }
			if(minutes.first().content.toUpperCase() === "CANCEL") { return m.channel.send("Canceled"); }
			try {
				db.prepare("UPDATE guilds SET expire = ? WHERE id = ?").run(parseInt(minutes.first().content), m.guild.id);
			} catch(e) {
				m.client.logger(e, "error");
				return m.channel.send(`failed to update configuration due to: ${e.toString()}`);
			}
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Expiration time updated",
							value: `Captchas will now expire after **${parseInt(minutes.first().content)}** minutes`
						}
					]
				}
			});
			break;
		}
		case "7": {
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Set an expiration message",
							value: "Type an expiration message below. Expiration messages are sent together with a new captcha when a user attempts to solve an expired captcha. You can use the following placeholders:\n\n**%USER%** - Mention the new member\n**%NAME%** - The new member's username\n**%GUILD%** - The guild's name\n\nTo disable expiration messages type `disable`\nTo cancel type `cancel`\nExample:```Sorry %USER%, your captcha has expired. Have a new one:```"
						}
					]
				}
			});
			const welcome = await m.channel.awaitMessages(w => w.author.id === m.author.id, {
				max: 1,
				time: 120000
			});
			if(!welcome.size) { return m.channel.send("setup timed out"); }
			if(welcome.first().content.toUpperCase() === "DISABLE") { welcome.first().content = "disabled"; }
			if(welcome.first().content.toUpperCase() === "CANCEL") { return m.channel.send("Canceled"); }
			try {
				db.prepare("UPDATE guilds SET expire_message = ? WHERE id = ?").run(welcome.first().content, m.guild.id);
			} catch(e) {
				m.client.logger(e, "error");
				return m.channel.send(`failed to update configuration due to: ${e.toString()}`);
			}
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Expiration message updated",
							value: `The new expiration message is:\n\n${welcome.first().content.length > 1000 ? `${welcome.first().content.substr(0, 1000)}...` : welcome.first().content}`
						}
					]
				}
			});
			break;
		}
		case "8": {
			await m.channel.send({
				embed: {
					title: "Config",
					description: "Auto kick",
					fields: [
						{
							name: "[1] Enable Auto kick",
							value: "Enables automatic kicking of users who fail to solve the captcha before it expires"
						},
						{
							name: "[2] Disable Auto kick",
							value: "Disables automatic kicking"
						},
						{
							name: "[3] Cancel",
							value: "Exit this menu"
						}
					]
				}
			});
			const enabled = await m.channel.awaitMessages(w => w.author.id === m.author.id && ["1", "2", "3"].includes(w.content), {
				max: 1,
				time: 60000
			});
			if(!enabled.size) { return m.channel.send("setup timed out"); }
			if(enabled.first().content === "3") { return m.channel.send("canceled"); }
			if(enabled.first().content === "1") {
				if(!m.guild.me.hasPermission("KICK_MEMBERS")) { return m.channel.send("Cannot enable auto kick. Missing permission to kick members."); }
			}
			try {
				db.prepare("UPDATE guilds SET autokick = ? WHERE id = ?").run(enabled.first().content === "1" ? 1 : 0, m.guild.id);
			} catch(e) {
				m.client.logger(e, "error");
				return m.channel.send(`failed to update configuration due to: ${e.toString()}`);
			}
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Captcha auto kick changed",
							value: `Auto kick is now **${enabled.first().content === "1" ? "Enabled" : "Disabled"}**`
						}
					]
				}
			});
			break;
		}
		case "9": {
			await m.channel.send({
				embed: {
					title: "Config",
					description: "Captcha status",
					fields: [
						{
							name: "[1] Enable Captcha",
							value: "Captcha is enabled"
						},
						{
							name: "[2] Disable Captcha",
							value: "Disable Captcha without losing configuration"
						},
						{
							name: "[3] Cancel",
							value: "Exit this menu"
						}
					]
				}
			});
			const enabled = await m.channel.awaitMessages(w => w.author.id === m.author.id && ["1", "2", "3"].includes(w.content), {
				max: 1,
				time: 60000
			});
			if(!enabled.size) { return m.channel.send("setup timed out"); }
			if(enabled.first().content === "3") { return m.channel.send("canceled"); }
			if(enabled.first().content === "1") {
				if(!m.guild.me.hasPermission("MANAGE_ROLES")) { return m.channel.send("Cannot enable Captcha. The MANAGE ROLES permission is required for Captcha to function"); }
				if(!m.guild.roles.cache.get(config.role)) { return m.channel.send("Cannot enable Captcha. The verified role is not configured correctly"); }
				if(!m.guild.roles.cache.get(config.role).editable) { return m.channel.send("Cannot enable Captcha. No permission to use the verified role"); }
				if(!channel.name) { return m.channel.send("Cannot enable Captcha. The gateway channel is not configured correctly"); }
				if(!channel.permissionsFor(m.guild.me).has("SEND_MESSAGES")) { return m.channel.send("Cannot enable Captcha. No permission to send messages in the gateway channel"); }
			}
			try {
				db.prepare("UPDATE guilds SET enabled = ? WHERE id = ?").run(enabled.first().content === "1" ? 1 : 0, m.guild.id);
			} catch(e) {
				m.client.logger(e, "error");
				return m.channel.send(`failed to update configuration due to: ${e.toString()}`);
			}
			await m.channel.send({
				embed: {
					title: "Config",
					fields: [
						{
							name: "Captcha status changed",
							value: `Captcha status is now **${enabled.first().content === "1" ? "Enabled" : "Disabled"}**`
						}
					]
				}
			});
			break;
		}
		case "10": {
			await m.channel.send("canceled");
			break;
		}
	}
};
