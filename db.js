"use strict";

const Database = require("better-sqlite3");
const db = new Database("./captcha.db");

// db.prepare("CREATE TABLE IF NOT EXISTS guilds (id TEXT PRIMARY KEY,channel TEXT,role TEXT,message TEXT,strength INT,sensitive INT);").run();
// db.prepare("CREATE TABLE IF NOT EXISTS pending (id TEXT PRIMARY KEY,guild TEXT,code TEXT,timestamp INT);").run();
// db.prepare("CREATE TABLE IF NOT EXISTS stats (id TEXT PRIMARY KEY,created INT,solved INT);").run();
// db.prepare("INSERT INTO stats (id,created,solved) VALUES ('stats',0,0)").run();
// db.prepare("ALTER TABLE guilds ADD COLUMN enabled INT").run(); db.prepare(`UPDATE guilds SET enabled = 1`).run();
// db.prepare("ALTER TABLE guilds ADD COLUMN expire INT").run(); db.prepare(`UPDATE guilds SET expire = 60`).run();
// db.prepare("ALTER TABLE guilds ADD COLUMN expire_message TEXT").run(); db.prepare(`UPDATE guilds SET expire_message = "Captcha expired, please try again:"`).run();
// db.prepare("ALTER TABLE guilds ADD COLUMN autokick INT").run(); db.prepare(`UPDATE guilds SET autokick = 0`).run();
// db.prepare("ALTER TABLE guilds ADD COLUMN autoban INT").run(); db.prepare(`UPDATE guilds SET autoban = 0`).run();
db.pragma("journal_mode = wal");
db.pragma("synchronous = 1");

db.guildsCache = new Set(db.prepare("SELECT id FROM guilds").all().map(t => t.id));
db.channelCache = new Set(db.prepare("SELECT channel FROM guilds").all().map(t => t.channel));
db.pendingCache = new Set(db.prepare("SELECT id FROM pending").all().map(t => t.id));

db.dbSet = function(table, data) {
	const s = db.prepare(`INSERT OR REPLACE INTO ${table} (${Object.keys(data).join(",")}) VALUES (${Object.keys(data).map(t => `@${t}`).join(",")})`);
	db[`${table}Cache`].add(data.id);
	if(table === "guilds") { db.channelCache.add(data.channel); }
	return s.run(data);
};

db.dbGet = function(table, index) {
	const s = db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
	return s.get(index);
};

db.dbDelete = function(table, id, channel, guild) {
	db[`${table}Cache`].delete(id);
	if(channel) { db.channelCache.delete(channel); }
	if(guild) {
		db.prepare("DELETE FROM pending WHERE guild = ?").run(guild);
		db.pendingCache = new Set(db.prepare("SELECT id FROM pending").all().map(t => t.id)); }
	return db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
};

db.incrStats = function(type) {
	if(type === "created") {
		db.prepare("UPDATE stats SET created = created+1 WHERE id = 'stats'").run();
	} else if(type === "solved") {
		db.prepare("UPDATE stats SET solved = solved+1 WHERE id = 'stats'").run();
	}
};

module.exports = db;
