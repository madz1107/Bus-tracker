-- =========================================================================
-- NELLAI72 REAL-TIME CITY BUS TRACKING - SUPABASE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ROUTES TABLE
CREATE TABLE IF NOT EXISTS public.routes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    color TEXT DEFAULT '#2563EB',
    stops JSONB DEFAULT '[]'::jsonb,
    roadway JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. BUSES TABLE
CREATE TABLE IF NOT EXISTS public.buses (
    id TEXT PRIMARY KEY,
    bus_number TEXT NOT NULL,
    reg_number TEXT NOT NULL,
    bus_name TEXT,
    route_id TEXT REFERENCES public.routes(id) ON DELETE SET NULL,
    assigned_route_ids JSONB DEFAULT '[]'::jsonb,
    conductor_id TEXT,
    conductor_name TEXT,
    conductor_phone TEXT,
    status TEXT DEFAULT 'Stopped',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0,
    bearing DOUBLE PRECISION DEFAULT 0,
    current_stop_id TEXT,
    current_stop_name TEXT,
    next_stop_id TEXT,
    next_stop_name TEXT,
    distance_to_next_km DOUBLE PRECISION DEFAULT 0,
    eta_minutes INTEGER DEFAULT 0,
    route_progress INTEGER DEFAULT 0,
    reached_stop_ids JSONB DEFAULT '[]'::jsonb,
    crowd_level TEXT DEFAULT 'Moderate',
    is_trip_active BOOLEAN DEFAULT false,
    simulator_index DOUBLE PRECISION DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('passenger', 'Bus', 'admin', 'conductor')),
    bus_id TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. FAVORITE COMMUTES TABLE
CREATE TABLE IF NOT EXISTS public.favorite_commutes (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT,
    route_id TEXT NOT NULL,
    stop_id TEXT,
    dest_id TEXT,
    bus_id TEXT,
    route_name TEXT,
    stop_name TEXT,
    dest_name TEXT,
    bus_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ENABLE ROW LEVEL SECURITY (RLS) BUT ALLOW PUBLIC READ/WRITE FOR PROTOTYPE
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_commutes ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read and write access for city bus live tracking
CREATE POLICY "Allow public read access on routes" ON public.routes FOR SELECT USING (true);
CREATE POLICY "Allow public write access on routes" ON public.routes FOR ALL USING (true);

CREATE POLICY "Allow public read access on buses" ON public.buses FOR SELECT USING (true);
CREATE POLICY "Allow public write access on buses" ON public.buses FOR ALL USING (true);

CREATE POLICY "Allow public read access on users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public write access on users" ON public.users FOR ALL USING (true);

CREATE POLICY "Allow public read access on favorite_commutes" ON public.favorite_commutes FOR SELECT USING (true);
CREATE POLICY "Allow public write access on favorite_commutes" ON public.favorite_commutes FOR ALL USING (true);

-- Enable Realtime publication for buses so changes stream instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.buses;

-- =========================================================================
-- SEED INITIAL DATA
-- =========================================================================

-- Route 1
INSERT INTO public.routes (id, name, code, color, stops) VALUES (
    'route-1',
    'Route 101 - New Bus Stand to Town Temple & Pettai',
    '101',
    '#2563EB',
    '[
        {"id": "stop-101-1", "name": "New Bus Stand (Vaeinthaankulam)", "lat": 8.7032, "lng": 77.7285, "sequence": 1},
        {"id": "stop-101-2", "name": "Palayamkottai Bus Stand", "lat": 8.7180, "lng": 77.7420, "sequence": 2},
        {"id": "stop-101-3", "name": "VOC Ground / St. Xavier''s", "lat": 8.7245, "lng": 77.7340, "sequence": 3},
        {"id": "stop-101-4", "name": "Nellai Railway Junction Overbridge", "lat": 8.7290, "lng": 77.7125, "sequence": 4},
        {"id": "stop-101-5", "name": "Tirunelveli Town Swami Nellaiappar Temple", "lat": 8.7305, "lng": 77.6880, "sequence": 5},
        {"id": "stop-101-6", "name": "Pettai Industrial Estate", "lat": 8.7450, "lng": 77.6710, "sequence": 6}
    ]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Route 2
INSERT INTO public.routes (id, name, code, color, stops) VALUES (
    'route-2',
    'Route 202 - TVMCH High Ground to Thazhaiyuthu Cements',
    '202',
    '#059669',
    '[
        {"id": "stop-202-1", "name": "TVMCH Medical College Hospital", "lat": 8.7095, "lng": 77.7560, "sequence": 1},
        {"id": "stop-202-2", "name": "Vannarpettai Bridge Bypass", "lat": 8.7260, "lng": 77.7220, "sequence": 2},
        {"id": "stop-202-3", "name": "Tirunelveli Collectorate & Court", "lat": 8.7330, "lng": 77.7250, "sequence": 3},
        {"id": "stop-202-4", "name": "Thachannallur Bypass Road (NH44)", "lat": 8.7520, "lng": 77.7190, "sequence": 4},
        {"id": "stop-202-5", "name": "Sankar Nagar / India Cements Thazhaiyuthu", "lat": 8.7840, "lng": 77.7290, "sequence": 5}
    ]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Route 3
INSERT INTO public.routes (id, name, code, color, stops) VALUES (
    'route-3',
    'Route 303 - Perumalpuram to New Bus Stand via Palayamkottai',
    '303',
    '#D97706',
    '[
        {"id": "stop-303-1", "name": "Perumalpuram Post Office", "lat": 8.6940, "lng": 77.7310, "sequence": 1},
        {"id": "stop-303-2", "name": "Perumalpuram Arch", "lat": 8.7010, "lng": 77.7360, "sequence": 2},
        {"id": "stop-303-3", "name": "Sarah Tucker College Corner", "lat": 8.7120, "lng": 77.7450, "sequence": 3},
        {"id": "stop-303-4", "name": "Palayamkottai Market Stop", "lat": 8.7175, "lng": 77.7390, "sequence": 4},
        {"id": "stop-303-5", "name": "New Bus Stand (Vaeinthaankulam)", "lat": 8.7032, "lng": 77.7285, "sequence": 5}
    ]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Seed Buses
INSERT INTO public.buses (id, bus_number, reg_number, bus_name, route_id, conductor_id, conductor_name, conductor_phone, status, lat, lng, speed, bearing, current_stop_id, current_stop_name, next_stop_id, next_stop_name, distance_to_next_km, eta_minutes, route_progress, crowd_level, is_trip_active) VALUES
('BUS-101', '101', 'TN-72-N-1892', 'Muthu Kumar', 'route-1', 'cond-1', 'Muthu Kumar', '+91 94431 12345', 'Running', 8.72935, 77.7136, 35, 308, 'stop-101-4', 'Nellai Railway Junction Overbridge', 'stop-101-5', 'Tirunelveli Town Swami Nellaiappar Temple', 2.8, 5, 45, 'Heavy', true),
('BUS-102', '102', 'TN-72-N-2045', 'Subbiah Thevar', 'route-1', 'cond-2', 'Subbiah Thevar', '+91 94432 23456', 'Running', 8.7295, 77.7020, 42, 270, 'stop-101-4', 'Nellai Railway Junction Overbridge', 'stop-101-5', 'Tirunelveli Town Swami Nellaiappar Temple', 1.8, 4, 65, 'Low', true),
('BUS-103', '103', 'TN-72-N-3110', 'Antony Raj', 'route-1', 'cond-3', 'Antony Raj', '+91 94433 34567', 'Running', 8.7050, 77.7300, 24, 45, 'stop-101-1', 'New Bus Stand (Vaeinthaankulam)', 'stop-101-2', 'Palayamkottai Bus Stand', 2.2, 7, 10, 'Heavy', true),
('BUS-201', '201', 'TN-72-N-4420', 'Kandasamy P.', 'route-2', 'cond-4', 'Kandasamy P.', '+91 94434 45678', 'Running', 8.7300, 77.7240, 38, 350, 'stop-202-2', 'Vannarpettai Bridge Bypass', 'stop-202-3', 'Tirunelveli Collectorate & Court', 1.1, 2, 40, 'Moderate', true),
('BUS-202', '202', 'TN-72-N-5120', 'Sankaranarayanan', 'route-2', 'cond-5', 'Sankaranarayanan', '+91 94435 56789', 'Offline', 8.7095, 77.7560, 0, 0, 'stop-202-1', 'TVMCH Medical College Hospital', 'stop-202-2', 'Vannarpettai Bridge Bypass', 0, 0, 0, 'Low', false),
('BUS-301', '301', 'TN-72-N-6234', 'Murugan V.', 'route-3', 'cond-6', 'Murugan V.', '+91 94436 67890', 'Running', 8.7010, 77.7360, 28, 60, 'stop-303-2', 'Perumalpuram Arch', 'stop-303-3', 'Sarah Tucker College Corner', 1.6, 3, 30, 'Moderate', true)
ON CONFLICT (id) DO NOTHING;

-- Seed Users
INSERT INTO public.users (id, email, password, name, role, bus_id, phone) VALUES
('user-admin', 'admin@123', 'admin@123', 'Nellai Transit Control Officer', 'admin', null, null),
('cond-1', 'conductor1@citybus.com', 'pass123', 'Muthu Kumar', 'Bus', 'BUS-101', '+91 94431 12345'),
('cond-2', 'conductor2@citybus.com', 'pass123', 'Subbiah Thevar', 'Bus', 'BUS-102', '+91 94432 23456'),
('cond-3', 'conductor3@citybus.com', 'pass123', 'Antony Raj', 'Bus', 'BUS-103', '+91 94433 34567'),
('cond-4', 'conductor4@citybus.com', 'pass123', 'Kandasamy P.', 'Bus', 'BUS-201', '+91 94434 45678'),
('user-pass-1', 'passenger@citybus.com', 'pass123', 'Priya Sharma', 'passenger', null, null)
ON CONFLICT (id) DO NOTHING;
