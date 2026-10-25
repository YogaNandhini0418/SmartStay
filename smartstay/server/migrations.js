import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { primaryHostelTypes,defaultDepartments } from './seed-config.js';

// Versioned, additive migration. Existing primary keys and operational records survive.
export function migrate(db, databasePath) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  if (db.prepare('SELECT version FROM schema_migrations WHERE version=2').get()) return;
  if (databasePath !== ':memory:' && existsSync(databasePath)) {
    const folder=join(dirname(databasePath),'backups');mkdirSync(folder,{recursive:true});
    const backup=join(folder,`before-approval-v2-${Date.now()}.sqlite`);
    db.exec(`VACUUM INTO '${backup.replaceAll("'","''")}'`);
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const add=(table,column,type)=>{if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);};
    add('hostels','accommodation_type',"TEXT NOT NULL DEFAULT 'Non-AC' CHECK(accommodation_type IN ('AC','Non-AC'))");
    add('hostels','active','INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))');
    add('users','account_status',"TEXT NOT NULL DEFAULT 'APPROVED' CHECK(account_status IN ('PENDING','APPROVED','REJECTED','SUSPENDED'))");
    add('users','requested_hostel_id','INTEGER REFERENCES hostels(id)');
    add('users','assigned_hostel_id','INTEGER REFERENCES hostels(id)');
    add('users','employee_id','TEXT');
    add('users','specialization','TEXT');
    add('users','shift',"TEXT NOT NULL DEFAULT 'Day'");
    add('users','approved_at','TEXT');add('users','approved_by','INTEGER REFERENCES users(id)');
    add('users','rejection_reason','TEXT');
    add('students','gender',"TEXT NOT NULL DEFAULT 'Male' CHECK(gender IN ('Male','Female'))");
    add('notifications','hostel_id','INTEGER REFERENCES hostels(id)');
    add('iot_devices','hostel_id','INTEGER REFERENCES hostels(id)');
    add('audit_logs','details',"TEXT NOT NULL DEFAULT '{}'");
    db.exec("CREATE TABLE IF NOT EXISTS departments(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))); CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_case ON users(lower(email)); CREATE UNIQUE INDEX IF NOT EXISTS idx_user_employee ON users(employee_id) WHERE employee_id IS NOT NULL; CREATE UNIQUE INDEX IF NOT EXISTS idx_roll_case ON students(upper(registration_number)); CREATE INDEX IF NOT EXISTS idx_account_review ON users(account_status,created_at); CREATE INDEX IF NOT EXISTS idx_user_hostel ON users(assigned_hostel_id); CREATE INDEX IF NOT EXISTS idx_notification_hostel ON notifications(hostel_id)");
    defaultDepartments.forEach(name=>db.prepare('INSERT OR IGNORE INTO departments(name) VALUES(?)').run(name));
    const types=primaryHostelTypes.map(h=>[h.name,h.category,h.accommodation_type]);
    const legacy=['Boys Hostel A','Boys Hostel B','Girls Hostel A','Girls Hostel B'];
    const rows=db.prepare('SELECT * FROM hostels ORDER BY id').all();
    if(rows.length!==4)throw new Error('Migration requires four existing hostels; review additional hostel records before migrating. No data has been removed.');
    types.forEach(([name,category,ac],i)=>{
      db.prepare('UPDATE hostels SET name=?,category=?,accommodation_type=? WHERE id=?').run(name,category,ac,rows[i].id);
      ['notifications','audit_logs'].forEach(table=>{
        const col=table==='notifications'?'message':'action';
        db.prepare(`UPDATE ${table} SET ${col}=replace(${col},?,?) WHERE instr(${col},?)>0`).run(legacy[i],name,legacy[i]);
      });
    });
    db.exec("UPDATE students SET gender='Female' WHERE hostel_id IN (SELECT id FROM hostels WHERE category='Girls'); UPDATE students SET department='CSE – AI' WHERE department='CSE-AI'; UPDATE students SET department='CSE – Data Science' WHERE department='CSE-DS'");
    db.exec("UPDATE users SET assigned_hostel_id=COALESCE((SELECT hostel_id FROM students WHERE user_id=users.id),(SELECT hostel_id FROM wardens WHERE user_id=users.id),(SELECT hostel_id FROM staff WHERE user_id=users.id)), employee_id=COALESCE((SELECT warden_code FROM wardens WHERE user_id=users.id),(SELECT staff_code FROM staff WHERE user_id=users.id)), shift=COALESCE((SELECT shift FROM wardens WHERE user_id=users.id),(SELECT shift FROM staff WHERE user_id=users.id),'Day'), account_status=CASE WHEN active=1 THEN 'APPROVED' ELSE 'SUSPENDED' END,approved_at=created_at");
    db.exec("UPDATE users SET requested_hostel_id=assigned_hostel_id; UPDATE iot_devices SET hostel_id=COALESCE((SELECT hostel_id FROM rooms WHERE id=iot_devices.room_id),(SELECT id FROM hostels ORDER BY id LIMIT 1))");
    // Every seed login staff member starts in their existing assigned hostel. Historical
    // tickets keep their room/student ownership; cross-hostel staff assignments are released.
    db.exec("UPDATE maintenance_requests SET assigned_staff_id=NULL,status=CASE WHEN status IN ('Assigned','In Progress') THEN 'Reported' ELSE status END WHERE assigned_staff_id IS NOT NULL AND EXISTS(SELECT 1 FROM staff st JOIN rooms r ON r.id=maintenance_requests.room_id WHERE st.id=maintenance_requests.assigned_staff_id AND st.hostel_id<>r.hostel_id)");
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS four_primary_hostels BEFORE INSERT ON hostels BEGIN SELECT RAISE(ABORT,'SmartStay supports exactly four primary hostel types'); END;
      CREATE TRIGGER IF NOT EXISTS protect_hostel_type BEFORE UPDATE OF name,category,accommodation_type ON hostels WHEN NEW.name<>OLD.name OR NEW.category<>OLD.category OR NEW.accommodation_type<>OLD.accommodation_type BEGIN SELECT RAISE(ABORT,'Primary hostel types cannot be renamed'); END;
      CREATE TRIGGER IF NOT EXISTS preserve_primary_hostels BEFORE DELETE ON hostels BEGIN SELECT RAISE(ABORT,'Primary hostels cannot be deleted'); END;
      CREATE TRIGGER IF NOT EXISTS student_gender_insert BEFORE INSERT ON students WHEN NEW.hostel_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM hostels WHERE id=NEW.hostel_id AND category=CASE NEW.gender WHEN 'Male' THEN 'Boys' ELSE 'Girls' END) BEGIN SELECT RAISE(ABORT,'Gender does not match hostel'); END;
      CREATE TRIGGER IF NOT EXISTS student_gender_update BEFORE UPDATE OF gender,hostel_id,bed_id ON students WHEN (NEW.hostel_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM hostels WHERE id=NEW.hostel_id AND category=CASE NEW.gender WHEN 'Male' THEN 'Boys' ELSE 'Girls' END)) OR (NEW.bed_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM beds b JOIN rooms r ON r.id=b.room_id WHERE b.id=NEW.bed_id AND r.hostel_id=NEW.hostel_id AND r.id=NEW.room_id)) BEGIN SELECT RAISE(ABORT,'Gender or bed does not match assigned hostel'); END;
      CREATE TRIGGER IF NOT EXISTS student_hostel_insert AFTER INSERT ON students BEGIN UPDATE users SET assigned_hostel_id=NEW.hostel_id WHERE id=NEW.user_id; END;
      CREATE TRIGGER IF NOT EXISTS student_hostel_update AFTER UPDATE OF hostel_id ON students BEGIN UPDATE users SET assigned_hostel_id=NEW.hostel_id WHERE id=NEW.user_id; END;
      CREATE TRIGGER IF NOT EXISTS warden_hostel_insert AFTER INSERT ON wardens BEGIN UPDATE users SET assigned_hostel_id=NEW.hostel_id WHERE id=NEW.user_id; END;
      CREATE TRIGGER IF NOT EXISTS warden_hostel_update AFTER UPDATE OF hostel_id ON wardens BEGIN UPDATE users SET assigned_hostel_id=NEW.hostel_id WHERE id=NEW.user_id; END;
      CREATE TRIGGER IF NOT EXISTS staff_hostel_insert AFTER INSERT ON staff WHEN NEW.user_id IS NOT NULL BEGIN UPDATE users SET assigned_hostel_id=NEW.hostel_id WHERE id=NEW.user_id; END;
      CREATE TRIGGER IF NOT EXISTS staff_hostel_update AFTER UPDATE OF hostel_id ON staff WHEN NEW.user_id IS NOT NULL BEGIN UPDATE users SET assigned_hostel_id=NEW.hostel_id WHERE id=NEW.user_id; END;
    `);
    db.prepare('INSERT INTO schema_migrations(version) VALUES(2)').run();db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
