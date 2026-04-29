require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./db');

async function seed() {
  console.log('🌱 Seeding database...');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── Animal Types ──────────────────────────────────────────────────────────
    await conn.query(`INSERT IGNORE INTO AnimalTypes (name) VALUES ('Cat'),('Dog'),('Rabbit'),('Bird')`);
    const [atRows] = await conn.query('SELECT animal_type_id, name FROM AnimalTypes');
    const at = {};
    atRows.forEach(r => (at[r.name] = r.animal_type_id));
    console.log('  ✔ AnimalTypes seeded:', Object.keys(at).join(', '));

    // ── Accounts (Admins) ─────────────────────────────────────────────────────
    const adminHash = await bcrypt.hash('admin123', 10);
    const [a1] = await conn.query(
      `INSERT IGNORE INTO Accounts (name,email,mobile,date_of_birth,balance,password_hash,role)
       VALUES ('Admin Alice','admin@adopt.com','01700000001','1985-03-15',1000.00,?,'admin')`,
      [adminHash]
    );
    const [a2] = await conn.query(
      `INSERT IGNORE INTO Accounts (name,email,mobile,date_of_birth,balance,password_hash,role)
       VALUES ('Admin Bob','bob.admin@adopt.com','01700000002','1990-07-22',1000.00,?,'admin')`,
      [adminHash]
    );

    // Get admin IDs
    const [[adminAlice]] = await conn.query(`SELECT account_id FROM Accounts WHERE email='admin@adopt.com'`);
    const [[adminBob]]   = await conn.query(`SELECT account_id FROM Accounts WHERE email='bob.admin@adopt.com'`);
    await conn.query(`INSERT IGNORE INTO Admins (admin_id) VALUES (?),(?)`,[adminAlice.account_id, adminBob.account_id]);
    console.log('  ✔ Admin accounts seeded');

    // ── Accounts (Users) ──────────────────────────────────────────────────────
    const userHash = await bcrypt.hash('user123', 10);
    await conn.query(
      `INSERT IGNORE INTO Accounts (name,email,mobile,date_of_birth,balance,password_hash,role)
       VALUES ('Sara Khan','sara@example.com','01711111111','1995-06-10',750.00,?,'user')`,
      [userHash]
    );
    await conn.query(
      `INSERT IGNORE INTO Accounts (name,email,mobile,date_of_birth,balance,password_hash,role)
       VALUES ('Tom Ahmed','tom@example.com','01722222222','1998-11-25',300.00,?,'user')`,
      [userHash]
    );
    await conn.query(
      `INSERT IGNORE INTO Accounts (name,email,mobile,date_of_birth,balance,password_hash,role)
       VALUES ('Rina Mou','rina@example.com','01733333333','2001-02-14',500.00,?,'user')`,
      [userHash]
    );

    const [[userSara]] = await conn.query(`SELECT account_id FROM Accounts WHERE email='sara@example.com'`);
    const [[userTom]]  = await conn.query(`SELECT account_id FROM Accounts WHERE email='tom@example.com'`);
    const [[userRina]] = await conn.query(`SELECT account_id FROM Accounts WHERE email='rina@example.com'`);
    await conn.query(
      `INSERT IGNORE INTO Users (user_id) VALUES (?),(?),(?)`,
      [userSara.account_id, userTom.account_id, userRina.account_id]
    );
    console.log('  ✔ User accounts seeded');

    // ── Adoption Posts ────────────────────────────────────────────────────────
    const adoptionData = [
      { acc: userSara.account_id, desc: 'Sweet tabby kitten looking for a loving home.',  type_id: at['Cat'],    animal: 'Whiskers', gender: 'Female', age: 1,  loc: 'Dhaka'     },
      { acc: userTom.account_id,  desc: 'Friendly golden retriever, great with kids.',     type_id: at['Dog'],    animal: 'Buddy',    gender: 'Male',   age: 3,  loc: 'Chittagong' },
      { acc: userRina.account_id, desc: 'Playful lop-eared rabbit, fully vaccinated.',     type_id: at['Rabbit'], animal: 'Fluffy',   gender: 'Female', age: 2,  loc: 'Sylhet'     },
      { acc: userSara.account_id, desc: 'Gentle Persian cat, loves cuddles.',              type_id: at['Cat'],    animal: 'Luna',     gender: 'Female', age: 4,  loc: 'Dhaka'     },
      { acc: userTom.account_id,  desc: 'Energetic Labrador pup, needs active family.',   type_id: at['Dog'],    animal: 'Max',      gender: 'Male',   age: 1,  loc: 'Rajshahi'  },
      { acc: userRina.account_id, desc: 'Colorful parrot, can say 10+ words!',            type_id: at['Bird'],   animal: 'Polly',    gender: 'Male',   age: 5,  loc: 'Khulna'    },
    ];

    for (const d of adoptionData) {
      const [pr] = await conn.query(
        `INSERT INTO Posts (account_id,description,post_date,post_type) VALUES (?,?,CURDATE(),'Adoption')`,
        [d.acc, d.desc]
      );
      await conn.query(
        `INSERT INTO Adoptions (post_id,animal_type_id,animal_name,gender,age,location) VALUES (?,?,?,?,?,?)`,
        [pr.insertId, d.type_id, d.animal, d.gender, d.age, d.loc]
      );
    }
    console.log('  ✔ Adoption posts seeded (Cat × 2, Dog × 2, Rabbit × 1, Bird × 1)');

    // ── BuySell Posts ─────────────────────────────────────────────────────────
    const [bs1] = await conn.query(
      `INSERT INTO Posts (account_id,description,post_date,post_type) VALUES (?,'Premium dog vitamins, still sealed.',CURDATE(),'BuySell')`,
      [userSara.account_id]
    );
    const [bsRow1] = await conn.query(`INSERT INTO BuySell (post_id,category) VALUES (?,'Medicine')`, [bs1.insertId]);
    await conn.query(`INSERT INTO Medicine (buysell_id,expire_date) VALUES (?,'2026-12-31')`, [bsRow1.insertId]);

    const [bs2] = await conn.query(
      `INSERT INTO Posts (account_id,description,post_date,post_type) VALUES (?,'Interactive cat toy set, barely used.',CURDATE(),'BuySell')`,
      [userTom.account_id]
    );
    const [bsRow2] = await conn.query(`INSERT INTO BuySell (post_id,category) VALUES (?,'Toys')`, [bs2.insertId]);
    await conn.query(`INSERT INTO Toys (buysell_id) VALUES (?)`, [bsRow2.insertId]);

    const [bs3] = await conn.query(
      `INSERT INTO Posts (account_id,description,post_date,post_type) VALUES (?,'Bird multivitamin drops, half bottle remaining.',CURDATE(),'BuySell')`,
      [userRina.account_id]
    );
    const [bsRow3] = await conn.query(`INSERT INTO BuySell (post_id,category) VALUES (?,'Medicine')`, [bs3.insertId]);
    await conn.query(`INSERT INTO Medicine (buysell_id,expire_date) VALUES (?,'2027-03-15')`, [bsRow3.insertId]);
    console.log('  ✔ BuySell posts seeded (2 Medicine, 1 Toys)');

    // ── Donation Campaigns ────────────────────────────────────────────────────
    await conn.query(
      `INSERT INTO Donations (title,description,start_date,end_date,target_amount,current_amount,animal_type_id)
       VALUES ('Save Street Cats of Dhaka','Help us feed and vaccinate street cats in Dhaka city.','2026-01-01','2026-12-31',50000.00,12500.00,?)`,
      [at['Cat']]
    );
    await conn.query(
      `INSERT INTO Donations (title,description,start_date,end_date,target_amount,current_amount,animal_type_id)
       VALUES ('Dog Shelter Fund','Building a new shelter for rescued dogs in Chittagong.','2026-03-01','2026-09-30',80000.00,31000.00,?)`,
      [at['Dog']]
    );
    await conn.query(
      `INSERT INTO Donations (title,description,start_date,end_date,target_amount,current_amount,animal_type_id)
       VALUES ('General Animal Welfare Fund','Support all animals in need across Bangladesh.','2026-01-01','2026-12-31',100000.00,8000.00,NULL)`
    );
    console.log('  ✔ Donation campaigns seeded (3)');

    // ── Donation Transactions ─────────────────────────────────────────────────
    const [[don1]] = await conn.query(`SELECT donation_id FROM Donations WHERE title LIKE '%Street Cats%'`);
    const [[don2]] = await conn.query(`SELECT donation_id FROM Donations WHERE title LIKE '%Dog Shelter%'`);
    const [[don3]] = await conn.query(`SELECT donation_id FROM Donations WHERE title LIKE '%General%'`);

    await conn.query(
      `INSERT INTO Donation_Transactions (user_id,donation_id,amount,date) VALUES
       (?,?,500.00,CURDATE()),
       (?,?,1000.00,CURDATE()),
       (?,?,250.00,CURDATE())`,
      [userSara.account_id, don1.donation_id, userTom.account_id, don2.donation_id, userRina.account_id, don3.donation_id]
    );
    // Deduct from user balances
    await conn.query(`UPDATE Accounts SET balance = balance - 500  WHERE account_id = ?`, [userSara.account_id]);
    await conn.query(`UPDATE Accounts SET balance = balance - 1000 WHERE account_id = ?`, [userTom.account_id]);
    await conn.query(`UPDATE Accounts SET balance = balance - 250  WHERE account_id = ?`, [userRina.account_id]);
    console.log('  ✔ Donation transactions seeded');

    await conn.commit();
    console.log('\n✅ Database seeded successfully!\n');
    console.log('  Login credentials:');
    console.log('  ┌──────────────────────────────────────────┐');
    console.log('  │  Admin:  admin@adopt.com  / admin123      │');
    console.log('  │  Admin:  bob.admin@adopt.com / admin123   │');
    console.log('  │  User:   sara@example.com  / user123      │');
    console.log('  │  User:   tom@example.com   / user123      │');
    console.log('  │  User:   rina@example.com  / user123      │');
    console.log('  └──────────────────────────────────────────┘\n');
  } catch (err) {
    await conn.rollback();
    console.error('❌ Seed failed:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
