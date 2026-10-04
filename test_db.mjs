import mysql from 'mysql2/promise';

async function test() {
  try {
    console.log("Connecting...");
    const connection = await mysql.createConnection({
      host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: 'AdoDxUCftiadQuH.root',
      password: 'QA2h3GbXSvOl4mFx',
      database: 'test',
      ssl: { rejectUnauthorized: true }
    });
    
    console.log("Connected!");
    const [rows, fields] = await connection.execute('SHOW TABLES;');
    console.log("Tables:");
    console.log(rows);
    
    const [settings] = await connection.execute('SELECT count(*) FROM settings;');
    console.log("Settings count:", settings);
    
    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
