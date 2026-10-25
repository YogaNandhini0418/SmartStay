PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, role_id INTEGER NOT NULL REFERENCES roles(id), email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, full_name TEXT NOT NULL, phone TEXT, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS hostels (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, category TEXT NOT NULL, address TEXT,
  warden_user_id INTEGER REFERENCES users(id), facilities TEXT NOT NULL DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS floors (id INTEGER PRIMARY KEY, hostel_id INTEGER NOT NULL REFERENCES hostels(id), floor_number INTEGER NOT NULL, UNIQUE(hostel_id,floor_number));
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY, hostel_id INTEGER NOT NULL REFERENCES hostels(id), floor_id INTEGER NOT NULL REFERENCES floors(id),
  room_number TEXT NOT NULL UNIQUE, room_type TEXT NOT NULL DEFAULT 'Standard', capacity INTEGER NOT NULL DEFAULT 4,
  cleaning_status TEXT NOT NULL DEFAULT 'Clean', maintenance_status TEXT NOT NULL DEFAULT 'Clear', lights_status TEXT NOT NULL DEFAULT 'Off', door_status TEXT NOT NULL DEFAULT 'Locked'
);
CREATE TABLE IF NOT EXISTS beds (id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES rooms(id), bed_number INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Available', UNIQUE(room_id,bed_number));
CREATE TABLE IF NOT EXISTS wardens (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id), warden_code TEXT NOT NULL UNIQUE, hostel_id INTEGER REFERENCES hostels(id), shift TEXT NOT NULL DEFAULT 'Day', status TEXT NOT NULL DEFAULT 'Active');
CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), staff_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT NOT NULL, hostel_id INTEGER REFERENCES hostels(id), shift TEXT NOT NULL, availability TEXT NOT NULL DEFAULT 'Available');
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id), student_code TEXT NOT NULL UNIQUE,
  registration_number TEXT NOT NULL UNIQUE, department TEXT NOT NULL, year INTEGER NOT NULL, guardian_name TEXT,
  guardian_phone TEXT, emergency_phone TEXT, hostel_id INTEGER REFERENCES hostels(id), room_id INTEGER REFERENCES rooms(id),
  bed_id INTEGER REFERENCES beds(id), joining_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  current_status TEXT NOT NULL DEFAULT 'Inside Hostel'
);
CREATE TABLE IF NOT EXISTS room_allocations (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), bed_id INTEGER NOT NULL REFERENCES beds(id),
  allocated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, vacated_at TEXT, allocated_by INTEGER REFERENCES users(id), note TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_bed_assignment ON room_allocations(bed_id) WHERE vacated_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_student_assignment ON room_allocations(student_id) WHERE vacated_at IS NULL;
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), attendance_date TEXT NOT NULL,
  status TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'Manual', recorded_by INTEGER REFERENCES users(id), recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id,attendance_date)
);
CREATE TABLE IF NOT EXISTS gate_logs (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), exit_time TEXT, entry_time TEXT,
  expected_return TEXT, reason TEXT, status TEXT NOT NULL, recorded_by INTEGER REFERENCES users(id), source TEXT NOT NULL DEFAULT 'Gate', created_at TEXT DEFAULT CURRENT_TIMESTAMP,late_alerted_at TEXT
);
CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY, request_code TEXT NOT NULL UNIQUE, student_id INTEGER NOT NULL REFERENCES students(id), leave_type TEXT NOT NULL,
  from_date TEXT NOT NULL, to_date TEXT NOT NULL, departure_time TEXT NOT NULL, expected_return TEXT NOT NULL,
  destination TEXT NOT NULL, reason TEXT NOT NULL, emergency_contact TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending',
  approved_by INTEGER REFERENCES users(id), reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS key_handovers (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), key_code TEXT NOT NULL, handed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  received_by INTEGER REFERENCES users(id), returned_at TEXT, returned_by INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id INTEGER PRIMARY KEY, ticket_code TEXT NOT NULL UNIQUE, student_id INTEGER REFERENCES students(id), room_id INTEGER REFERENCES rooms(id),
  category TEXT NOT NULL, description TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'Medium', status TEXT NOT NULL DEFAULT 'Reported',
  assigned_staff_id INTEGER REFERENCES staff(id), resolution TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY, complaint_code TEXT NOT NULL UNIQUE, student_id INTEGER NOT NULL REFERENCES students(id), category TEXT NOT NULL,
  description TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'Normal', confidential INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Submitted', assigned_to INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS complaint_updates (id INTEGER PRIMARY KEY, complaint_id INTEGER NOT NULL REFERENCES complaints(id), user_id INTEGER REFERENCES users(id), note TEXT NOT NULL, status TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS laundry_requests (
  id INTEGER PRIMARY KEY, request_code TEXT NOT NULL UNIQUE, student_id INTEGER NOT NULL REFERENCES students(id), clothes_count INTEGER NOT NULL,
  service_type TEXT NOT NULL, pickup_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Requested', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Normal', read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), emergency_type TEXT NOT NULL, details TEXT NOT NULL,
  contact_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS room_inspections (
  id INTEGER PRIMARY KEY, hostel_id INTEGER NOT NULL REFERENCES hostels(id), user_id INTEGER NOT NULL REFERENCES users(id),
  inspection_date TEXT NOT NULL, rooms_checked INTEGER NOT NULL, issues_found TEXT NOT NULL, action_taken TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Completed', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES rooms(id), staff_id INTEGER REFERENCES staff(id),
  scheduled_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Scheduled', completed_at TEXT
);
CREATE TABLE IF NOT EXISTS iot_devices (id INTEGER PRIMARY KEY, device_code TEXT NOT NULL UNIQUE, room_id INTEGER REFERENCES rooms(id), device_type TEXT NOT NULL, label TEXT NOT NULL, demo_value TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Normal', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS iot_readings (id INTEGER PRIMARY KEY, device_id INTEGER NOT NULL REFERENCES iot_devices(id), value TEXT NOT NULL, recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), service TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS hostel_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, entity_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), entity TEXT NOT NULL, entity_id INTEGER NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, content BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS biometric_events (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), method TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 1, recorded_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS maintenance_assignments (id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL REFERENCES maintenance_requests(id), staff_id INTEGER NOT NULL REFERENCES staff(id), assigned_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS password_reset_requests (id INTEGER PRIMARY KEY, email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_allocations_student ON room_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_complaints_student ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_laundry_student ON laundry_requests(student_id);
CREATE TABLE IF NOT EXISTS visitors (id INTEGER PRIMARY KEY, name TEXT NOT NULL,phone TEXT NOT NULL,purpose TEXT NOT NULL,student_id INTEGER REFERENCES students(id),visit_date TEXT NOT NULL,entry_time TEXT NOT NULL,exit_time TEXT,recorded_by INTEGER REFERENCES users(id));
CREATE TABLE IF NOT EXISTS seed_versions(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS laundry_updates(id INTEGER PRIMARY KEY,request_id INTEGER NOT NULL REFERENCES laundry_requests(id),status TEXT NOT NULL,user_id INTEGER REFERENCES users(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_alerts(status,created_at);
CREATE INDEX IF NOT EXISTS idx_attachment_owner ON attachments(user_id,entity,entity_id);
CREATE INDEX IF NOT EXISTS idx_visitors_date ON visitors(visit_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_gate_status ON gate_logs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
