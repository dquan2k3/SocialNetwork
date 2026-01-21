"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ToastProvider() {
  return (
    <>
      {/* SYSTEM TOAST */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        theme="colored"
      />

      {/* CHAT TOAST */}
      <ToastContainer
        containerId="chat"
        position="bottom-left"
        autoClose={5000}
        hideProgressBar={true}
        stacked
        closeOnClick
        pauseOnHover
        limit={5}
      />
    </>
  );
}
