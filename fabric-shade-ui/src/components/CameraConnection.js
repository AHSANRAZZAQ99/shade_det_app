import React, { useState } from "react";

function CameraConnection() {

    const [cameraType, setCameraType] = useState("usb");

    const [formData, setFormData] = useState({
        index: 0,
        ip: "",
        username: "",
        password: "",
        port: 554,
        channel: 1,
        subtype: 0
    });

    const [message, setMessage] = useState("");

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };


    const connectCamera = async () => {

        try {

            let payload = {};

            if (cameraType === "usb") {

                payload = {
                    type: "usb",
                    index: Number(formData.index)
                };

            } else {

                payload = {
                    type: "rtsp",
                    ip: formData.ip,
                    username: formData.username,
                    password: formData.password,
                    port: Number(formData.port),
                    channel: Number(formData.channel),
                    subtype: Number(formData.subtype)
                };
            }


            const response = await fetch(
                "http://127.0.0.1:5000/api/camera/configure",
                {
                    method: "POST",
                    headers:{
                        "Content-Type":"application/json"
                    },
                    body: JSON.stringify(payload)
                }
            );


            const data = await response.json();

            if(data.ok){
                setMessage("Camera configuration saved successfully");
            }
            else{
                setMessage(data.error);
            }


        } catch(error){

            setMessage("Backend connection failed");

        }

    };


    return (

        <section className="max-h-full overflow-y-auto rounded-lg border border-[var(--panel-border)] bg-[#d9dde3] p-2 shadow-sm">

            <div className="mb-3 border-b border-[#b9c2ce] pb-2">

                <h3 className="text-[16px] font-bold text-steel-700">
                    Camera Connection
                </h3>

            </div>


            <div className="mb-3 flex gap-3">

                <button
                    onClick={()=>setCameraType("usb")}
                    className={`rounded px-3 py-2 text-white ${
                        cameraType==="usb"
                        ?"bg-blue-700"
                        :"bg-gray-500"
                    }`}
                >
                    Laptop Camera
                </button>


                <button
                    onClick={()=>setCameraType("rtsp")}
                    className={`rounded px-3 py-2 text-white ${
                        cameraType==="rtsp"
                        ?"bg-blue-700"
                        :"bg-gray-500"
                    }`}
                >
                    RTSP Camera
                </button>

            </div>



            {
                cameraType==="usb" && (

                    <input
                        className="mb-2 w-full rounded border p-2"
                        name="index"
                        value={formData.index}
                        onChange={handleChange}
                        placeholder="Camera Index"
                    />

                )
            }



            {
                cameraType==="rtsp" && (

                <div className="max-h-[calc(100vh-420px)] overflow-y-auto pr-1">

                    <input className="mb-2 w-full rounded border p-1"
                    name="ip"
                    placeholder="Camera IP"
                    onChange={handleChange}/>


                    <input className="mb-2 w-full rounded border p-1"
                    name="username"
                    placeholder="Username"
                    onChange={handleChange}/>


                    <input className="mb-2 w-full rounded border p-1"
                    name="password"
                    placeholder="Password"
                    type="password"
                    onChange={handleChange}/>


                    <input className="mb-2 w-full rounded border p-1"
                    name="port"
                    placeholder="Port"
                    value={formData.port}
                    onChange={handleChange}/>


                    <input className="mb-2 w-full rounded border p-1"
                    name="channel"
                    placeholder="Channel"
                    value={formData.channel}
                    onChange={handleChange}/>


                    <input className="mb-2 w-full rounded border p-1"
                    name="subtype"
                    placeholder="Subtype"
                    value={formData.subtype}
                    onChange={handleChange}/>


                </div>

                )
            }



            <button
                onClick={connectCamera}
                className="w-full rounded bg-gradient-to-b from-blue-600 to-blue-700 px-3 py-2 font-semibold text-white"
            >
                Connect Camera
            </button>


            {
                message && (

                    <p className="mt-3 text-sm font-semibold text-[#365577]">
                        {message}
                    </p>

                )
            }


        </section>

    );

}


export default CameraConnection;