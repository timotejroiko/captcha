"use strict";

module.exports = async m => {
	await m.channel.send({
		embed: {
			title: "Hey there, im Captcha! Here's what i can do:",
			description: "-",
			thumbnail: { url: m.client.user.avatarURL({ format: "png" }) },
			fields: [
				{
					name: "Commands",
					value: "**@captcha setup** - Setup Captcha in this guild\n**@captcha config** - Configure Captcha in this guild\n**@captcha status** - Check if Captcha is configured correctly\n**@captcha reset** - Reset Captcha in this guild\n**@captcha info** - Display information and statistics\n**@captcha help** - Open this message\n-"
				},
				{
					name: "Information",
					value: "**Add Captcha to your guild** -> [Invite](https://discordapp.com/api/oauth2/authorize?client_id=580578395411185664&permissions=372624464&scope=bot)\n**Support Server** -> [Astro Dev](https://discord.gg/BpeedKh)\n**Vote for Captcha** -> [Top.gg](https://discordbots.org/bot/580578395411185664/vote)\n**Support Captcha** -> [Patreon](https://patreon.com/timotejroiko)\n-"
				}
			]
		}
	});
};
