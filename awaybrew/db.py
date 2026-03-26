import os
from datetime import datetime
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

# Initialize Databrew connection pool
databrew_pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name="databrew_pool",
    pool_size=5,
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME"),
    ssl_disabled=False,
)

try:
    connection = databrew_pool.get_connection()
    cursor = connection.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS brew_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            title VARCHAR(255) DEFAULT 'My Brew',
            temperature FLOAT NOT NULL,
            flow_rate FLOAT NOT NULL,
            quantity FLOAT NOT NULL DEFAULT 30,
            start_timestamp TIMESTAMP NOT NULL,
            favourite BOOLEAN DEFAULT FALSE
        )
    """)

    # Attempt to gracefully alter the table if it already exists from a previous step
    try:
        cursor.execute(
            "ALTER TABLE brew_requests ADD COLUMN title VARCHAR(255) DEFAULT 'My Brew'"
        )
    except mysql.connector.Error as err:
        # Error 1060 is "Duplicate column name", meaning it already exists
        if err.errno != 1060:
            print(f"Non-fatal error adding title column: {err}")

    try:
        cursor.execute(
            "ALTER TABLE brew_requests ADD COLUMN quantity FLOAT NOT NULL DEFAULT 30"
        )
    except mysql.connector.Error as err:
        # Error 1060 is "Duplicate column name", meaning it already exists
        if err.errno != 1060:
            print(f"Non-fatal error adding quantity column: {err}")

    connection.commit()
finally:
    if "cursor" in locals():
        cursor.close()
    if "connection" in locals() and connection.is_connected():
        connection.close()

print("Databrew connection initialized successfully")


def create_brew_request(
    user_id: str,
    title: str,
    temperature: float,
    flow_rate: float,
    quantity: float,
    start_timestamp: datetime,
    favourite: bool,
):
    connection = databrew_pool.get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
        INSERT INTO brew_requests (user_id, title, temperature, flow_rate, quantity, start_timestamp, favourite)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
            (
                user_id,
                title,
                temperature,
                flow_rate,
                quantity,
                start_timestamp,
                favourite,
            ),
        )
        connection.commit()
        last_id = cursor.lastrowid
        cursor.close()
        return last_id
    finally:
        connection.close()


def favourite_brew_request(brew_id: int, favourite_status: bool):
    connection = databrew_pool.get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
        UPDATE brew_requests SET favourite = %s WHERE id = %s
        """,
            (favourite_status, brew_id),
        )
        connection.commit()
        cursor.close()
    finally:
        connection.close()


def get_user_brew_requests(user_id: str, number_of_requests: int):
    connection = databrew_pool.get_connection()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
        SELECT id, user_id, title, temperature, flow_rate, quantity, start_timestamp, favourite
        FROM brew_requests 
        WHERE user_id = %s 
        ORDER BY start_timestamp DESC 
        LIMIT %s
        """,
            (user_id, number_of_requests),
        )
        results = cursor.fetchall()
        cursor.close()
        return results
    finally:
        connection.close()


def get_user_favourites(user_id: str):
    connection = databrew_pool.get_connection()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
        SELECT id, user_id, title, temperature, flow_rate, quantity, start_timestamp, favourite
        FROM brew_requests 
        WHERE user_id = %s AND favourite = TRUE
        ORDER BY start_timestamp DESC
        """,
            (user_id,),
        )
        results = cursor.fetchall()
        cursor.close()
        return results
    finally:
        connection.close()
