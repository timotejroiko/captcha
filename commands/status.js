"use strict";

module.exports = async (m, db) => {
	if(!m.member.hasPermission("ADMINISTRATOR")) { return m.channel.send("You must be a Guild Admin to setup captcha"); }
	const config = db.dbGet("guilds", m.guild.id);

	const embed = {
		title: "Captcha Setup",
		fields: [
			{
				name: "`-----\nRequired permissions for normal operation:`",
				value: "▼"
			}
		]
	};

	if(!config) {
		return m.channel.send("Captcha is not enabled in this guild");
	}

	let channel = m.guild.channels.cache.get(config.channel);
	if(!channel) { channel = await m.client.channels.fetch(config.channel).catch(() => null); }

	const role = m.guild.roles.cache.get(config.role);

	if(m.guild.available) {	embed.fields.push({
		name: "Guild Available",
		value: "✅",
		inline: true
	}); } else { embed.fields.push({
		name: "Guild Available",
		value: "❌",
		inline: true
	}); }
	if(m.guild.me.hasPermission("MANAGE_ROLES")) { embed.fields.push({
		name: "Can assign roles",
		value: "✅",
		inline: true
	}); } else { embed.fields.push({
		name: "Can assign roles",
		value: "❌",
		inline: true
	}); }
	if(role) { embed.fields.push({
		name: "Verified role exists",
		value: "✅",
		inline: true
	}); } else { embed.fields.push({
		name: "Verified role exists",
		value: "❌",
		inline: true
	}); }
	if(role && role.editable) { embed.fields.push({
		name: "Can assign verified role",
		value: "✅",
		inline: true
	}); } else { embed.fields.push({
		name: "Can assign verified role",
		value: "❌",
		inline: true
	}); }
	if(channel) { embed.fields.push({
		name: "Gateway channel exists",
		value: "✅",
		inline: true
	}); } else { embed.fields.push({
		name: "Gateway channel exists",
		value: "❌",
		inline: true
	}); }
	if(channel && channel.permissionsFor(m.guild.me).has("SEND_MESSAGES")) { embed.fields.push({
		name: "Can post in gateway channel",
		value: "✅",
		inline: true
	}); } else { embed.fields.push({
		name: "Can post in gateway channel",
		value: "❌",
		inline: true
	}); }
	if(channel && channel.permissionsFor(m.guild.me).has("ATTACH_FILES")) { embed.fields.push({
		name: "Can post images in gateway",
		value: "✅",
		inline: true
	}); } else { embed.fields.push({
		name: "Can post images in gateway",
		value: "❌",
		inline: true
	}); }

	embed.fields.push({
		name: "`-----\nRequired permissions for setup or optional features:`",
		value: "▼"
	});

	if(m.guild.roles.cache.get(m.guild.id).editable) { embed.fields.push({
		name: "Can edit @everyone",
		value: "✅",
		inline: true
	}); } else { embed.fields.push({
		name: "Can edit @everyone",
		value: "❌",
		inline: true
	}); }
	if(m.guild.me.hasPermission("MANAGE_CHANNELS")) { embed.fields.push({
		name: "Can create channels",
		value: "✅",
		inline: true
	}); } else { embed.fields.push({
		name: "Can create channels",
		value: "❌",
		inline: true
	}); }
	if(m.guild.me.hasPermission("KICK_MEMBERS")) { embed.fields.push({
		name: "Can kick members",
		value: "✅",
		inline: true
	}); } else { embed.fields.push({
		name: "Can kick members",
		value: "❌",
		inline: true
	}); }

	embed.fields.push({
		name: "`-----\nCurrent Status`",
		value: `▼\n\nEnabled: ${config.enabled ? "✅" : "❌"}`
	});

	await m.channel.send({ embed });
};
