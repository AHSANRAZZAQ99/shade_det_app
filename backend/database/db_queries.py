from database.mysql_connection import get_connection



# ==============================
# CAMERA QUERIES
# ==============================

def save_camera(
        camera_name,
        ip_address,
        username,
        password,
        port,
        channel,
        subtype,
        rtsp_url
):
    print("save_camera() called")
    connection = get_connection()

    if connection is None:
        return False


    try:

        cursor = connection.cursor()


        query = """
        INSERT INTO cameras
        (
            camera_name,
            ip_address,
            username,
            password,
            port,
            channel,
            subtype,
            rtsp_url,
            status
        )

        VALUES
        (
            %s,%s,%s,%s,%s,%s,%s,%s,%s
        )
        """


        values = (
            camera_name,
            ip_address,
            username,
            password,
            port,
            channel,
            subtype,
            rtsp_url,
            "online"
        )


        cursor.execute(query, values)
        connection.commit()
        print("Camera saved successfully.")

        connection.commit()


        cursor.close()
        connection.close()


        return True


    except Exception as e:

        print("Save camera error:", e)

        return False





# ==============================
# DETECTION QUERIES
# ==============================

def save_detection(
        image_name,
        image_path,
        defect_detected,
        defect_type,
        deltaE,
        density
):

    conn = get_connection()

    cursor = conn.cursor()


    query = """
    INSERT INTO detection_records
    (
        image_name,
        image_path,
        defect_detected,
        defect_type,
        deltaE,
        density
    )

    VALUES
    (%s,%s,%s,%s,%s,%s)
    """


    values = (
        image_name,
        image_path,
        defect_detected,
        defect_type,
        deltaE,
        density
    )


    cursor.execute(
        query,
        values
    )

    conn.commit()


    cursor.close()
    conn.close()


    print("Detection record saved")




# ==============================
# LOG QUERIES
# ==============================

def save_log(log_type, message):

    connection = get_connection()


    if connection is None:
        return False


    try:

        cursor = connection.cursor()


        query = """
        INSERT INTO system_logs
        (
            log_type,
            message
        )

        VALUES(%s,%s)
        """


        cursor.execute(
            query,
            (
                log_type,
                message
            )
        )


        connection.commit()


        cursor.close()
        connection.close()


        return True


    except Exception as e:

        print("Save log error:", e)

        return False


def get_system_logs(limit=50):

    connection = get_connection()

    cursor = connection.cursor(dictionary=True)


    query = """
        SELECT
            id,
            log_type,
            message,
            created_at
        FROM system_logs
        ORDER BY id DESC
        LIMIT %s
    """


    cursor.execute(
        query,
        (limit,)
    )


    logs = cursor.fetchall()


    cursor.close()
    connection.close()


    return logs

def get_detection_records(limit=20):

    conn = get_connection()

    cursor = conn.cursor(dictionary=True)


    query = """
        SELECT
            id,
            image_name,
            image_path,
            defect_detected,
            defect_type,
            deltaE,
            density,
            created_at

        FROM detection_records

        ORDER BY id DESC

        LIMIT %s
    """


    cursor.execute(
        query,
        (limit,)
    )


    records = cursor.fetchall()


    cursor.close()
    conn.close()


    return records


def clear_detection_records():

    conn = get_connection()

    if conn is None:
        return False

    try:
        cursor = conn.cursor()

        cursor.execute("DELETE FROM detection_records")
        conn.commit()

        cursor.close()
        conn.close()

        return True

    except Exception as e:
        print("Clear detection records error:", e)
        try:
            conn.rollback()
        except Exception:
            pass
        try:
            cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass
        return False