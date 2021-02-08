"use strict";

module.exports = async (m, db) => {
	if(!m.member.hasPermission("ADMINISTRATOR")) { return m.channel.send("You must be a Guild Admin to setup captcha"); }
	const config = db.dbGet("guilds", m.guild.id);
	if(!config) { return m.channel.send("No configuration found for this guild"); }
	await m.channel.send({
		embed: {
			title: "Reset",
			description: `The following configuration was found for this guild:\n\nGateway Channel ID: **${config.channel}**\nVerified Role ID: **${config.role}**`,
			fields: [
				{
					name: "[1] Full Reset",
					value: "This option will **delete the gateway channel**, **delete the verified role** and reset the `@everyone` role to default permissions"
				},
				{
					name: "[2] Remove Config",
					value: "This option will remove the guild configuration but not change any channel or role. Chose this to manually clean up your guild."
				},
				{
					name: "[3] Cancel",
					value: "Cancel"
				}
			]
		}
	});
	const reply = await m.channel.awaitMessages(r => r.author.id === m.author.id && ["1", "2", "3"].includes(r.content), {
		max: 1,
		time: 60000
	});
	if(!reply.size) { return m.channel.send("setup timed out"); }
	if(reply.first().content === "1") {
		if(!m.guild.available) { return m.channel.send("Guild unavailable, is discord having issues?"); }
		if(!m.guild.me.hasPermission("MANAGE_CHANNELS")) { return m.channel.send("The MANAGE CHANNELS permission is required during setup. It can be safely disabled after the setup is completed"); }
		if(!m.guild.me.hasPermission("MANAGE_ROLES")) { return m.channel.send("The MANAGE ROLES permission is required for Captcha to function"); }
		if(!m.guild.roles.cache.get(m.guild.id).editable) { return m.channel.send("The `@everyone` role is not editable"); }
		const errors = [];
		try {
			await m.guild.channels.forge(config.channel, "text").delete();
		} catch(e) {
			errors.push("failed to delete channel, please delete it manually if its not already deleted");
		}
		try {
			await m.guild.roles.cache.get(config.role).delete();
		} catch(e) {
			errors.push("failed to delete role, please delete it manually if its not already deleted");
		}
		try {
			await m.guild.roles.cache.get(m.guild.id).setPermissions(m.guild.me.permissions.bitfield & 104189504);
		} catch(e) { errors.push("failed to reset permissions for `@everyone`"); }
		await m.channel.send(errors.length ? `Guild was reset with errors:\n${errors.join("\n")}` : "Guild was reset successfully");
		db.dbDelete("guilds", m.guild.id, config.channel, m.guild.id);
	} else if(reply.first().content === "2") {
		db.dbDelete("guilds", m.guild.id, config.channel, m.guild.id);
		await m.channel.send("Guild configuration was reset successfully");
	} else if(reply.first().content === "3") {
		await m.channel.send("canceled");
	}
};
