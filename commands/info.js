"use strict";

module.exports = async (m, db) => {
	return m.channel.send({
		embed: {
			title: "Info",
			description: "-",
			thumbnail: { url: m.client.user.avatarURL({ format: "png" }) },
			fields: [
				{
					name: "Author",
					value: `**${(await m.client.users.fetch("180112943612952577")).tag}**`
				},
				{
					name: "Guilds",
					value: `**${m.client.guilds.cache.size}**`
				},
				{
					name: "Captchas Generated",
					value: `**${db.prepare("SELECT created FROM stats WHERE id = ?").get("stats").created}**`
				},
				{
					name: "Captchas Solved",
					value: `**${db.prepare("SELECT solved FROM stats WHERE id = ?").get("stats").solved}**`
				}
			]
		}
	});
};
