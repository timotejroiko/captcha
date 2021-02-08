"use strict";

module.exports = async (m, db) => {
	if(!m.member.hasPermission("ADMINISTRATOR")) { return m.channel.send("You must be a Guild Admin to setup captcha"); }
	if(!m.guild.available) { return m.channel.send("Guild unavailable, is discord having issues?"); }
	if(!m.guild.me.hasPermission("MANAGE_CHANNELS")) { return m.channel.send("The MANAGE CHANNELS permission is required during setup. It can be safely disabled after the setup is completed"); }
	if(!m.guild.me.hasPermission("MANAGE_ROLES")) { return m.channel.send("The MANAGE ROLES permission is required for Captcha to function"); }
	if(!m.guild.roles.cache.get(m.guild.id).editable) { return m.channel.send("The `@everyone` role is not editable"); }
	const channels = await m.guild.channels.fetch(false);
	await m.channel.send({
		embed: {
			title: "Setup",
			description: "Select the prefered setup mode:",
			fields: [
				{
					name: "[1] Automatic Mode",
					value: "This option will create a channel and a role, and will also modify the `@everyone` role\n(requires manage channels and manage roles)"
				},
				{
					name: "[2] Manual Mode",
					value: "This option will ask you for an existing channel and role to configure\n(requires manage roles)"
				},
				{
					name: "[3] Cancel",
					value: "Exit setup"
				}
			]
		}
	});
	const reply = await m.channel.awaitMessages(r => r.author.id === m.author.id && ["1", "2", "3"].includes(r.content), {
		max: 1,
		time: 60000
	});
	if(!reply.size) { return m.channel.send("setup timed out"); }
	switch(reply.first().content) {
		case "1": {
			await m.channel.send({
				embed: {
					title: "Setup",
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
			const warnings = [];
			channels.forEach(c => {
				if(c.permissionOverwrites.size && c.permissionOverwrites.get(m.guild.id)) {
					if(c.permissionOverwrites.get(m.guild.id).allow & 1024) { warnings.push(c.name); }
				}
			});
			if(warnings.length) {
				await m.channel.send({
					embed: {
						title: "Setup",
						description: `Warning: one or more of your guild's channels contain permission overwrites that allow the \`@everyone\` role to see them. This means an unverified person will be able to see them before solving the captcha. The following channels are affected:\n\n**${warnings.join("\n")}**\n-`,
						fields: [
							{
								name: "[1] Remove permission overwrites",
								value: "This will reset the *read text channels & see voice channels* permission for the `@everyone` role in all channels"
							},
							{
								name: "[2] Keep permission overwrites",
								value: "This will not change anything. Chose this to manually edit permissions later"
							}
						]
					}
				});
				const confirm = await m.channel.awaitMessages(c => c.author.id === m.author.id && ["1", "2"].includes(c.content), {
					max: 1,
					time: 60000
				});
				if(!confirm.size) { return m.channel.send("setup timed out"); }
				if(reply.first().content === "1") {
					try {
						for(const c of channels.values()) {
							if(c.permissionOverwrites.size && c.permissionOverwrites.get(m.guild.id)) {
								if(c.permissionOverwrites.get(m.guild.id).allow & 1024) {
									await c.updateOverwrite(m.guild.id, { VIEW_CHANNEL: false }, "[Captcha] prevent unverified users from seeing this channel");
								}
							}
						}
					} catch(e) {
						m.client.logger(e, "error");
						return m.channel.send(`failed to overwrite permissions due to: ${e.toString()}`);
					}
				}
			}
			try {
				const vRole = await m.guild.roles.create({
					data: {
						name: "verified",
						permissions: m.guild.me.permissions.bitfield & 104189504
					}
				});
				const vChannel = await m.guild.channels.create("gateway", {
					position: 0,
					type: "text",
					permissionOverwrites: [{
						id: m.guild.id,
						allow: 3072
					}, {
						id: vRole.id,
						deny: 1024
					}, {
						id: m.guild.me.id,
						allow: 52224
					}]
				});
				await m.guild.roles.cache.get(m.guild.id).setPermissions(66048);
				db.dbSet("guilds", {
					id: m.guild.id,
					channel: vChannel.id,
					role: vRole.id,
					message: welcome.first().content,
					strength: 5,
					sensitive: 0,
					enabled: 1,
					expire: 60,
					expire_message: "Captcha expired, please try again:",
					autokick: 0,
					autoban: 0
				});
			} catch(e) { db.dbDelete("guilds", m.guild.id); await m.channel.send("Setup failed. Missing permissions?"); throw e; }
			await m.channel.send({
				embed: {
					title: "Setup",
					fields: [
						{
							name: "Success",
							value: "Setup completed successfully. New users will be placed in the **#gateway** channel, and will be given the **verified** role after solving the captcha.\n\nYou can safely edit the channel name and position, as well as the role name, color and permissions. You can also configure additional options using the config command"
						}
					]
				}
			});
			break;
		}
		case "2": {
			if(!m.guild.available) { return m.channel.send("Guild unavailable, is discord having issues?"); }
			await m.channel.send({
				embed: {
					title: "Setup",
					fields: [
						{
							name: "Select a gateway channel",
							value: "Mention the channel you wish to use as an entry point to this guild. Its permissions will be modified. To cancel type `cancel`\nExample:```#noobs-start-here```"
						}
					]
				}
			});
			const channel = await m.channel.awaitMessages(w => {
				if(w.author.id === m.author.id) {
					if(w.content.toUpperCase() === "CANCEL") { return true; }
					if(channels.get(w.content.replace(/\D+/g, ""))) {
						return true;
					}
					m.channel.send("channel not found, try again");

				}
			}, {
				max: 1,
				time: 60000
			});
			if(!channel.size) { return m.channel.send("setup timed out"); }
			if(channel.first().content.toUpperCase() === "CANCEL") { return m.channel.send("Canceled"); }
			const vChannel = channels.get(channel.first().content.replace(/\D+/g, ""));
			await m.channel.send({
				embed: {
					title: "Setup",
					fields: [
						{
							name: "Select a role to assign",
							value: "Mention or type the name or ID of the role you wish to give people who solve the captcha. Its permissions will be modified. To cancel type `cancel`\nExample:```not a noob anymore```"
						}
					]
				}
			});
			const role = await m.channel.awaitMessages(w => {
				if(w.author.id === m.author.id) {
					if(w.content.toUpperCase() === "CANCEL") { return true; }
					const f = m.guild.roles.cache.filter(r => r.name.toUpperCase() === w.content.toUpperCase() || r.id === w.content.replace(/\D/g, ""));
					if(f.size === 1) {
						if(f.first().editable) {
							return true;
						}
						m.channel.send("role found but not accessible, make sure i have enough permissions to use it");

					} else {
						if(!f.size) { m.channel.send("role not found"); }
						if(f.size > 1) { m.channel.send("found multiple roles with the same name, please give it a unique name or use the role ID instead"); }
					}
				}
			}, {
				max: 1,
				time: 60000
			});
			if(!role.size) { return m.channel.send("setup timed out"); }
			if(role.first().content.toUpperCase() === "CANCEL") { return m.channel.send("Canceled"); }
			const vRole = m.guild.roles.cache.get(role.first().content.replace(/\D/g, "")) || m.guild.roles.cache.find(r => r.name.toUpperCase() === role.first().content.toUpperCase());
			await m.channel.send({
				embed: {
					title: "Setup",
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
			await m.channel.send({
				embed: {
					title: "Setup",
					description: "To make sure everything works correctly, we need to edit the `@everyone` role, more specifically remove its ability to see channels, should i do it now?",
					fields: [
						{
							name: "[1] Yes",
							value: "This option will edit the `@everyone` role"
						},
						{
							name: "[2] No",
							value: "This option will skip this step"
						}
					]
				}
			});
			const everyone = await m.channel.awaitMessages(w => w.author.id === m.author.id && ["1", "2"].includes(w.content), {
				max: 1,
				time: 60000
			});
			if(!everyone.size) { return m.channel.send("setup timed out"); }
			let editeveryone = false;
			if(everyone.first().content === "1") {
				editeveryone = true;
			}
			const warnings = [];
			channels.forEach(c => {
				if(c.permissionOverwrites.size && c.permissionOverwrites.get(m.guild.id)) {
					if(c.permissionOverwrites.get(m.guild.id).allow & 1024) { warnings.push(c.name); }
				}
			});
			if(warnings.length) {
				await m.channel.send({
					embed: {
						title: "Setup",
						description: `Warning: one or more of your guild's channels contain permission overwrites that allow the \`@everyone\` role to see them. This means an unverified person will be able to see them before solving the captcha. The following channels are affected:\n\n**${warnings.join("\n")}**\n-`,
						fields: [
							{
								name: "[1] Remove permission overwrites",
								value: "This will remove the `see channels` permission from the `@everyone` role in the above channels"
							},
							{
								name: "[2] Keep permission overwrites",
								value: "This will not change anything. Chose this to manually edit permissions later"
							}
						]
					}
				});
				const confirm = await m.channel.awaitMessages(c => c.author.id === m.author.id && ["1", "2"].includes(c.content), {
					max: 1,
					time: 60000
				});
				if(!confirm.size) { return m.channel.send("setup timed out"); }
				if(reply.first().content === "1") {
					try {
						for(const c of channels.values()) {
							if(c.permissionOverwrites.size && c.permissionOverwrites.get(m.guild.id)) {
								if(c.permissionOverwrites.get(m.guild.id).allow & 1024) {
									await c.updateOverwrite(m.guild.id, { VIEW_CHANNEL: false });
								}
							}
						}
					} catch(e) {
						m.client.logger(e, "error");
						return m.channel.send(`failed to overwrite permissions due to: ${e.toString()}`);
					}
				}
			}
			try {
				await vRole.setPermissions(m.guild.me.permissions.bitfield & 104189504);
				await vChannel.overwritePermissions([{
					id: m.guild.id,
					allow: 3072
				}, {
					id: vRole.id,
					deny: 1024
				}, {
					id: m.guild.me.id,
					allow: 52224
				}]);
				if(editeveryone) { await m.guild.roles.cache.get(m.guild.id).setPermissions(66048); }
				db.dbSet("guilds", {
					id: m.guild.id,
					channel: vChannel.id,
					role: vRole.id,
					message: welcome.first().content,
					strength: 5,
					sensitive: 0,
					enabled: 1,
					expire: 60,
					expire_message: "Captcha expired, please try again:",
					autokick: 0,
					autoban: 0
				});
			} catch(e) { db.dbDelete("guilds", m.guild.id); await m.channel.send("Setup failed. Missing permissions"); throw e; }
			await m.channel.send({
				embed: {
					title: "Setup",
					fields: [
						{
							name: "Success",
							value: `Setup completed successfully. New users will be placed in the **#${vChannel.name}** channel, and will be given the **${vRole.name}** role after solving the captcha.\n\nYou can safely edit the channel name and position, as well as the role name, color and permissions. You can also configure additional options using the config command`
						}
					]
				}
			});
			break;
		}
		case "3": {
			await m.channel.send("Canceled");
			break;
		}
	}
};
