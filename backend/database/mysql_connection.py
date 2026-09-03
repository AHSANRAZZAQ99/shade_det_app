import mysql.connector
from mysql.connector import Error


def get_connection():

    try:

        connection = mysql.connector.connect(

            host="localhost",

            user="root",

            password="password",

            database="shade_detection"

        )


        if connection.is_connected():

            return connection


    except Error as e:

        print("MySQL Connection Error:", e)


    return None