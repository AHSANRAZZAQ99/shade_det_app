from db_queries import save_log


result = save_log(
    "SYSTEM",
    "MySQL query test successful"
)


if result:
    print("LOG INSERTED")

else:
    print("FAILED")