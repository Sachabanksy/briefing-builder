-- database/init/02-seed.sql

-- Insert sample users (passwords should be hashed in real app)
INSERT INTO users (username, email, password_hash) VALUES
    ('alice', 'alice@example.com', 'hashed_password_1'),
    ('bob', 'bob@example.com', 'hashed_password_2'),
    ('charlie', 'charlie@example.com', 'hashed_password_3')
ON CONFLICT (username) DO NOTHING;

-- Insert sample posts
INSERT INTO posts (user_id, title, content, published) VALUES
    (1, 'Getting Started with PostgreSQL', 'PostgreSQL is a powerful open-source database...', true),
    (1, 'Docker Compose Tips', 'Here are some useful Docker Compose patterns...', true),
    (2, 'Python Best Practices', 'Writing clean Python code...', true),
    (3, 'My First Draft', 'This is a work in progress...', false)
ON CONFLICT DO NOTHING;