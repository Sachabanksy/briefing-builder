# main.py
from src.database import db

def get_all_users():
    """Fetch all users from database"""
    with db.get_cursor() as cursor:
        cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
        return cursor.fetchall()

def get_user_posts(user_id):
    """Fetch all posts for a specific user"""
    with db.get_cursor() as cursor:
        cursor.execute(
            "SELECT * FROM posts WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        return cursor.fetchall()

def create_post(user_id, title, content, published=False):
    """Create a new post"""
    with db.get_cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO posts (user_id, title, content, published)
            VALUES (%s, %s, %s, %s)
            RETURNING id, title, created_at
            """,
            (user_id, title, content, published)
        )
        return cursor.fetchone()

def main():
    print("=== Testing Database Connection ===\n")
    
    # Test 1: Get all users
    print("All Users:")
    users = get_all_users()
    for user in users:
        print(f"  - {user['username']} ({user['email']})")
    
    print("\n" + "="*40 + "\n")
    
    # Test 2: Get posts for first user
    if users:
        first_user = users[0]
        print(f"Posts by {first_user['username']}:")
        posts = get_user_posts(first_user['id'])
        for post in posts:
            status = "Published" if post['published'] else "Draft"
            print(f"  - [{status}] {post['title']}")
    
    print("\n" + "="*40 + "\n")
    
    # Test 3: Create a new post
    if users:
        new_post = create_post(
            user_id=users[0]['id'],
            title="Test Post from Docker",
            content="This post was created while running in Docker!",
            published=True
        )
        print(f"Created new post: {new_post['title']}")
        print(f"Post ID: {new_post['id']}")
        print(f"Created at: {new_post['created_at']}")

if __name__ == "__main__":
    main()