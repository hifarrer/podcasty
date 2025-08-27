"use client";
import { useState } from "react";

export default function DebugWavespeedPage() {
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const submitToWavespeed = async () => {
    setLoading(true);
    setLogs([]);
    setRequestId("");
    setVideoUrl("");

    try {
      addLog("Step 1: Submitting to Wavespeed API...");
      
      const response = await fetch("/api/debug-wavespeed/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      addLog(`Step 1 Response Status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        addLog(`Step 1 Error: ${errorText}`);
        return;
      }

      const result = await response.json();
      addLog(`Step 1 Response: ${JSON.stringify(result, null, 2)}`);
      
      if (result.id) {
        setRequestId(result.id);
        addLog(`Step 1 Success: Got request ID ${result.id}`);
        
        // Start polling for results
        pollForResults(result.id);
      } else {
        addLog("Step 1 Error: No ID in response");
      }
    } catch (error) {
      addLog(`Step 1 Exception: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const pollForResults = async (id: string) => {
    addLog(`Step 2: Starting to poll for results with ID: ${id}`);
    
    const pollInterval = setInterval(async () => {
      try {
        addLog(`Step 2: Polling for results...`);
        
        const response = await fetch(`/api/debug-wavespeed/result?requestId=${id}`, {
          method: "GET",
        });

        addLog(`Step 2 Response Status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          addLog(`Step 2 Error: ${errorText}`);
          return;
        }

        const result = await response.json();
        addLog(`Step 2 Response: ${JSON.stringify(result, null, 2)}`);
        
        if (result.status === "succeeded" && result.output) {
          addLog(`Step 2 Success: Video ready!`);
          setVideoUrl(result.output);
          clearInterval(pollInterval);
        } else if (result.status === "failed") {
          addLog(`Step 2 Error: Generation failed - ${result.error || "Unknown error"}`);
          clearInterval(pollInterval);
        } else {
          addLog(`Step 2: Still processing (status: ${result.status})`);
        }
      } catch (error) {
        addLog(`Step 2 Exception: ${error}`);
        clearInterval(pollInterval);
      }
    }, 10000); // Poll every 10 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      addLog("Step 2: Polling timeout after 5 minutes");
    }, 300000);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Wavespeed API Debug</h1>
        
        <div className="bg-[#2a2a2a] rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Test Configuration</h2>
          <div className="text-[#cccccc] mb-4">
            <p><strong>Audio URL:</strong> https://podcasty-lime.vercel.app/api/proxy/episodes%2F9b388262-4e90-4077-b3fc-d73f3369ac69.mp3</p>
            <p><strong>Image URL:</strong> https://podcasty-lime.vercel.app/assets/images/p8.jpg</p>
            <p><strong>Prompt:</strong> a person talking in a podcast</p>
          </div>
          
          <button
            onClick={submitToWavespeed}
            disabled={loading}
            className="bg-[#00c8c8] hover:bg-[#00a8a8] text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit to Wavespeed"}
          </button>
        </div>

        {requestId && (
          <div className="bg-[#2a2a2a] rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Request ID</h2>
            <p className="text-[#00c8c8] font-mono">{requestId}</p>
          </div>
        )}

        {videoUrl && (
          <div className="bg-[#2a2a2a] rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Generated Video</h2>
            <video
              controls
              className="w-full max-w-2xl"
              preload="metadata"
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <p className="text-[#cccccc] mt-2">Video URL: {videoUrl}</p>
          </div>
        )}

        <div className="bg-[#2a2a2a] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Debug Logs</h2>
          <div className="bg-[#1a1a1a] rounded-lg p-4 h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-[#666666]">No logs yet. Click &quot;Submit to Wavespeed&quot; to start.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log, index) => (
                  <div key={index} className="text-sm font-mono text-[#cccccc]">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
