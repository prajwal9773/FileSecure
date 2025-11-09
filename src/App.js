import React, { useState, useRef } from 'react';
import { Upload, Download, Key, Lock, Shield, FileText, CheckCircle, AlertCircle, Info, Trash2, Copy, Eye, EyeOff, Clock, FileCheck } from 'lucide-react';

function App() {
  const [file, setFile] = useState(null);
  const [encryptedPackage, setEncryptedPackage] = useState(null);
  const [decryptedData, setDecryptedData] = useState(null);
  const [rsaKeyPair, setRsaKeyPair] = useState(null);
  const [aesKey, setAesKey] = useState(null);
  const [status, setStatus] = useState({ message: '', type: 'info' });
  const [activeTab, setActiveTab] = useState('encrypt');
  const [processing, setProcessing] = useState(false);
  const [encryptionHistory, setEncryptionHistory] = useState([]);
  const [showKeys, setShowKeys] = useState(false);
  const [exportedKeys, setExportedKeys] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const packageInputRef = useRef(null);

  // Helper functions
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const base64ToArrayBuffer = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const updateStatus = (message, type = 'info') => {
    setStatus({ message, type });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Generate RSA key pair
  const generateRSAKeys = async () => {
    try {
      setProcessing(true);
      updateStatus('Generating RSA-2048 key pair...', 'info');
      
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );
      
      setRsaKeyPair(keyPair);
      
      // Export keys for display
      const publicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
      const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
      
      setExportedKeys({
        publicKey: arrayBufferToBase64(publicKey),
        privateKey: arrayBufferToBase64(privateKey)
      });
      
      updateStatus('✓ RSA-2048 key pair generated successfully!', 'success');
    } catch (err) {
      updateStatus(`✗ Error generating RSA keys: ${err.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Generate AES key
  const generateAESKey = async () => {
    try {
      setProcessing(true);
      updateStatus('Generating AES-256 key...', 'info');
      
      const key = await window.crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256,
        },
        true,
        ["encrypt", "decrypt"]
      );
      
      setAesKey(key);
      updateStatus('✓ AES-256 key generated successfully!', 'success');
    } catch (err) {
      updateStatus(`✗ Error generating AES key: ${err.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Handle drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  // Handle file selection
  const handleFileSelection = (selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
      updateStatus(`✓ File selected: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`, 'success');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    handleFileSelection(selectedFile);
  };

  // Encrypt file
  const encryptFile = async () => {
    if (!file) {
      updateStatus('✗ Please select a file first!', 'error');
      return;
    }
    if (!rsaKeyPair) {
      updateStatus('✗ Please generate RSA keys first!', 'error');
      return;
    }
    if (!aesKey) {
      updateStatus('✗ Please generate AES key first!', 'error');
      return;
    }

    try {
      setProcessing(true);
      updateStatus('Step 1/5: Reading file...', 'info');
      
      const fileData = await file.arrayBuffer();
      
      updateStatus('Step 2/5: Encrypting file with AES-256...', 'info');
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const encryptedFileData = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        fileData
      );
      
      updateStatus('Step 3/5: Exporting AES key...', 'info');
      const aesKeyRaw = await window.crypto.subtle.exportKey("raw", aesKey);
      
      updateStatus('Step 4/5: Encrypting AES key with RSA-2048...', 'info');
      const encryptedAesKey = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        rsaKeyPair.publicKey,
        aesKeyRaw
      );
      
      updateStatus('Step 5/5: Packaging encrypted data...', 'info');
      
      const pkg = {
        version: "2.0",
        encryptedFile: arrayBufferToBase64(encryptedFileData),
        encryptedAesKey: arrayBufferToBase64(encryptedAesKey),
        iv: arrayBufferToBase64(iv),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        timestamp: new Date().toISOString(),
        encryption: {
          file: "AES-256-GCM",
          key: "RSA-OAEP-2048"
        }
      };
      
      setEncryptedPackage(pkg);
      
      // Add to history
      setEncryptionHistory(prev => [{
        id: Date.now(),
        fileName: file.name,
        fileSize: file.size,
        timestamp: new Date().toISOString(),
        status: 'encrypted'
      }, ...prev.slice(0, 9)]);
      
      updateStatus('✓ File encrypted successfully! Ready for secure transfer.', 'success');
    } catch (err) {
      updateStatus(`✗ Encryption failed: ${err.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Load encrypted package
  const loadEncryptedPackage = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const pkg = JSON.parse(event.target.result);
        setEncryptedPackage(pkg);
        updateStatus('✓ Encrypted package loaded successfully!', 'success');
      } catch (err) {
        updateStatus('✗ Invalid encrypted package file!', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Decrypt file
  const decryptFile = async () => {
    if (!encryptedPackage) {
      updateStatus('✗ No encrypted package available!', 'error');
      return;
    }
    if (!rsaKeyPair) {
      updateStatus('✗ Private key not available!', 'error');
      return;
    }

    try {
      setProcessing(true);
      updateStatus('Step 1/3: Decrypting AES key with RSA private key...', 'info');
      
      const encryptedAesKeyBuffer = base64ToArrayBuffer(encryptedPackage.encryptedAesKey);
      
      const decryptedAesKeyRaw = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        rsaKeyPair.privateKey,
        encryptedAesKeyBuffer
      );
      
      updateStatus('Step 2/3: Importing decrypted AES key...', 'info');
      
      const importedAesKey = await window.crypto.subtle.importKey(
        "raw",
        decryptedAesKeyRaw,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
      
      updateStatus('Step 3/3: Decrypting file with AES key...', 'info');
      
      const iv = base64ToArrayBuffer(encryptedPackage.iv);
      const encryptedFileBuffer = base64ToArrayBuffer(encryptedPackage.encryptedFile);
      
      const decryptedFileData = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        importedAesKey,
        encryptedFileBuffer
      );
      
      setDecryptedData({
        data: decryptedFileData,
        fileName: encryptedPackage.fileName,
        fileType: encryptedPackage.fileType
      });
      
      updateStatus('✓ File decrypted successfully! Ready to download.', 'success');
    } catch (err) {
      updateStatus(`✗ Decryption failed: ${err.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Download functions
  const downloadEncrypted = () => {
    if (!encryptedPackage) return;
    
    const jsonStr = JSON.stringify(encryptedPackage, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encrypted_${encryptedPackage.fileName}.secure`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateStatus('✓ Encrypted package downloaded!', 'success');
  };

  const downloadDecrypted = () => {
    if (!decryptedData) return;
    
    const blob = new Blob([decryptedData.data], { type: decryptedData.fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decryptedData.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateStatus('✓ Decrypted file downloaded!', 'success');
  };

  const downloadKeys = () => {
    if (!exportedKeys) return;
    
    const keysData = {
      publicKey: exportedKeys.publicKey,
      privateKey: exportedKeys.privateKey,
      generated: new Date().toISOString(),
      algorithm: "RSA-OAEP-2048"
    };
    
    const blob = new Blob([JSON.stringify(keysData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rsa-keypair.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateStatus('✓ Keys exported!', 'success');
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    updateStatus(`✓ ${label} copied to clipboard!`, 'success');
  };

  const resetAll = () => {
    setFile(null);
    setEncryptedPackage(null);
    setDecryptedData(null);
    setRsaKeyPair(null);
    setAesKey(null);
    setExportedKeys(null);
    setEncryptionHistory([]);
    updateStatus('✓ All data cleared!', 'success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Shield className="w-12 h-12 md:w-16 md:h-16 text-purple-400 animate-pulse" />
              <Lock className="w-6 h-6 text-purple-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl md:text-5xl font-bold text-white">SecureTransfer</h1>
              <p className="text-purple-300 text-xs md:text-sm">Professional File Encryption System</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-xs md:text-sm">
            <span className="bg-purple-900/50 text-purple-200 px-3 py-1 rounded-full border border-purple-500/30">RSA-2048</span>
            <span className="bg-purple-900/50 text-purple-200 px-3 py-1 rounded-full border border-purple-500/30">AES-256-GCM</span>
            <span className="bg-purple-900/50 text-purple-200 px-3 py-1 rounded-full border border-purple-500/30">Zero-Knowledge</span>
          </div>
        </div>

        {/* Key Generation Section */}
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 md:p-6 mb-6 shadow-2xl border border-purple-500/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-semibold text-white flex items-center gap-2">
              <Key className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
              Cryptographic Keys
            </h2>
            {(rsaKeyPair || aesKey) && (
              <button
                onClick={resetAll}
                className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <button
              onClick={generateRSAKeys}
              disabled={processing}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
            >
              <Lock className="w-5 h-5" />
              {rsaKeyPair ? '✓ RSA Keys Ready' : 'Generate RSA-2048'}
            </button>
            
            <button
              onClick={generateAESKey}
              disabled={processing}
              className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
            >
              <Key className="w-5 h-5" />
              {aesKey ? '✓ AES Key Ready' : 'Generate AES-256'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className={`rounded-lg p-4 text-center transition-all ${rsaKeyPair ? 'bg-green-900/30 border-2 border-green-500' : 'bg-slate-700/50 border-2 border-slate-600'}`}>
              <div className="text-xs md:text-sm text-purple-300 mb-2 font-semibold">Public Key</div>
              {rsaKeyPair ? (
                <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-400 mx-auto" />
              ) : (
                <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-gray-500 mx-auto" />
              )}
            </div>
            
            <div className={`rounded-lg p-4 text-center transition-all ${rsaKeyPair ? 'bg-green-900/30 border-2 border-green-500' : 'bg-slate-700/50 border-2 border-slate-600'}`}>
              <div className="text-xs md:text-sm text-purple-300 mb-2 font-semibold">Private Key</div>
              {rsaKeyPair ? (
                <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-400 mx-auto" />
              ) : (
                <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-gray-500 mx-auto" />
              )}
            </div>
            
            <div className={`rounded-lg p-4 text-center transition-all ${aesKey ? 'bg-green-900/30 border-2 border-green-500' : 'bg-slate-700/50 border-2 border-slate-600'}`}>
              <div className="text-xs md:text-sm text-purple-300 mb-2 font-semibold">AES-256</div>
              {aesKey ? (
                <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-400 mx-auto" />
              ) : (
                <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-gray-500 mx-auto" />
              )}
            </div>
          </div>

          {exportedKeys && (
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-purple-200">Key Management</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowKeys(!showKeys)}
                    className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                  >
                    {showKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showKeys ? 'Hide' : 'View'}
                  </button>
                  <button
                    onClick={downloadKeys}
                    className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              </div>
              
              {showKeys && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-purple-300">Public Key (Base64)</span>
                      <button
                        onClick={() => copyToClipboard(exportedKeys.publicKey, 'Public key')}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="bg-slate-900 rounded p-2 text-xs text-green-400 font-mono break-all max-h-20 overflow-y-auto">
                      {exportedKeys.publicKey.substring(0, 100)}...
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-purple-300">Private Key (Base64)</span>
                      <button
                        onClick={() => copyToClipboard(exportedKeys.privateKey, 'Private key')}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="bg-slate-900 rounded p-2 text-xs text-red-400 font-mono break-all max-h-20 overflow-y-auto">
                      {exportedKeys.privateKey.substring(0, 100)}...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl shadow-2xl border border-purple-500/30 overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-purple-500/30">
                <button
                  onClick={() => setActiveTab('encrypt')}
                  className={`flex-1 px-4 py-4 font-semibold transition-all text-sm md:text-base ${
                    activeTab === 'encrypt'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-slate-700/50 text-gray-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  Encrypt
                </button>
                <button
                  onClick={() => setActiveTab('decrypt')}
                  className={`flex-1 px-4 py-4 font-semibold transition-all text-sm md:text-base ${
                    activeTab === 'decrypt'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-slate-700/50 text-gray-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Download className="w-4 h-4 inline mr-2" />
                  Decrypt
                </button>
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 px-4 py-4 font-semibold transition-all text-sm md:text-base ${
                    activeTab === 'info'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-slate-700/50 text-gray-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Info className="w-4 h-4 inline mr-2" />
                  About
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'encrypt' && (
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                      <Lock className="w-5 h-5 text-purple-400" />
                      Encrypt Your File
                    </h3>
                    
                    {/* Drag & Drop Zone */}
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={`mb-4 border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                        dragActive
                          ? 'border-purple-400 bg-purple-900/30'
                          : 'border-purple-500/30 bg-slate-700/30 hover:border-purple-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      
                      <Upload className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                      <p className="text-purple-200 mb-2 font-semibold">
                        Drag & Drop your file here
                      </p>
                      <p className="text-purple-300 text-sm mb-3">or</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition"
                      >
                        Browse Files
                      </button>
                      
                      {file && (
                        <div className="mt-4 bg-slate-800 rounded-lg p-3 flex items-center gap-3">
                          <FileText className="w-8 h-8 text-purple-400" />
                          <div className="text-left flex-1">
                            <div className="text-white font-semibold">{file.name}</div>
                            <div className="text-purple-300 text-sm">{formatFileSize(file.size)}</div>
                          </div>
                          <CheckCircle className="w-6 h-6 text-green-400" />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={encryptFile}
                      disabled={!file || !rsaKeyPair || !aesKey || processing}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg mb-4"
                    >
                      <Shield className="w-5 h-5" />
                      {processing ? 'Encrypting...' : 'Encrypt File Now'}
                    </button>

                    {encryptedPackage && (
                      <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-5 border-2 border-green-500/50">
                        <div className="flex items-center gap-2 text-green-400 mb-4">
                          <CheckCircle className="w-6 h-6" />
                          <h4 className="font-semibold text-lg">Encryption Successful!</h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <div className="text-xs text-purple-300 mb-1">Original File</div>
                            <div className="text-white font-semibold text-sm truncate">{encryptedPackage.fileName}</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <div className="text-xs text-purple-300 mb-1">Original Size</div>
                            <div className="text-white font-semibold text-sm">{formatFileSize(encryptedPackage.fileSize)}</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <div className="text-xs text-purple-300 mb-1">Encrypted Size</div>
                            <div className="text-white font-semibold text-sm">{formatFileSize(encryptedPackage.encryptedFile.length * 0.75)}</div>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <div className="text-xs text-purple-300 mb-1">Algorithm</div>
                            <div className="text-white font-semibold text-sm">AES-256</div>
                          </div>
                        </div>
                        
                        <button
                          onClick={downloadEncrypted}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                          <Download className="w-5 h-5" />
                          Download Encrypted Package (.secure)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'decrypt' && (
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                      <Key className="w-5 h-5 text-purple-400" />
                      Decrypt Your File
                    </h3>

                    {!encryptedPackage ? (
                      <div>
                        <div className="bg-slate-700/30 rounded-xl p-8 text-center border-2 border-dashed border-purple-500/30 mb-4">
                          <input
                            ref={packageInputRef}
                            type="file"
                            accept=".secure,.json"
                            onChange={loadEncryptedPackage}
                            className="hidden"
                          />
                          
                          <FileCheck className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                          <p className="text-purple-200 mb-2 font-semibold">
                            Load Encrypted Package
                          </p>
                          <p className="text-purple-300 text-sm mb-3">
                            Select the .secure file you want to decrypt
                          </p>
                          <button
                            onClick={() => packageInputRef.current?.click()}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition"
                          >
                            Select Package File
                          </button>
                        </div>
                        
                        <div className="bg-slate-700/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-amber-400 mb-2">
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-semibold text-sm">No Package Loaded</span>
                          </div>
                          <p className="text-gray-400 text-sm">
                            You can also encrypt a file in the Encrypt tab to test the decryption process.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="bg-slate-700/50 rounded-xl p-5 mb-4 border-2 border-purple-500/30">
                          <div className="flex items-center gap-2 text-green-400 mb-3">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-semibold">Package Loaded</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-purple-300">File Name:</span>
                              <span className="text-white font-semibold">{encryptedPackage.fileName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-purple-300">Original Size:</span>
                              <span className="text-white font-semibold">{formatFileSize(encryptedPackage.fileSize)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-purple-300">Encrypted:</span>
                              <span className="text-white font-semibold">{new Date(encryptedPackage.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-purple-300">Version:</span>
                              <span className="text-white font-semibold">{encryptedPackage.version}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={decryptFile}
                          disabled={!rsaKeyPair || processing}
                          className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg mb-4"
                        >
                          <Lock className="w-5 h-5" />
                          {processing ? 'Decrypting...' : 'Decrypt File Now'}
                        </button>

                        {!rsaKeyPair && (
                          <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 text-amber-400">
                              <AlertCircle className="w-5 h-5" />
                              <span className="font-semibold text-sm">Private Key Required</span>
                            </div>
                            <p className="text-amber-200 text-sm mt-2">
                              Generate RSA keys or import your private key to decrypt this file.
                            </p>
                          </div>
                        )}

                        {decryptedData && (
                          <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-5 border-2 border-green-500/50">
                            <div className="flex items-center gap-2 text-green-400 mb-4">
                              <CheckCircle className="w-6 h-6" />
                              <h4 className="font-semibold text-lg">Decryption Successful!</h4>
                            </div>
                            
                            <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                              <div className="flex items-center gap-3">
                                <FileText className="w-10 h-10 text-purple-400" />
                                <div className="flex-1">
                                  <div className="text-white font-semibold">{decryptedData.fileName}</div>
                                  <div className="text-purple-300 text-sm">Ready to download</div>
                                </div>
                              </div>
                            </div>
                            
                            <button
                              onClick={downloadDecrypted}
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                              <Download className="w-5 h-5" />
                              Download Original File
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'info' && (
                  <div className="space-y-5">
                    <div className="bg-gradient-to-br from-purple-900/50 to-slate-800/50 rounded-xl p-5 border border-purple-500/30">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-purple-400" />
                        How Hybrid Encryption Works
                      </h3>
                      <div className="space-y-4 text-sm">
                        <div className="bg-slate-800/50 rounded-lg p-4">
                          <div className="font-semibold text-purple-300 mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs">1</div>
                            Encryption Process
                          </div>
                          <ul className="list-disc list-inside ml-7 space-y-1 text-purple-100">
                            <li>Your file is encrypted using AES-256-GCM (symmetric, fast)</li>
                            <li>The AES key is encrypted with RSA-2048 public key (asymmetric, secure)</li>
                            <li>Both encrypted data are bundled into a secure package</li>
                          </ul>
                        </div>
                        
                        <div className="bg-slate-800/50 rounded-lg p-4">
                          <div className="font-semibold text-purple-300 mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs">2</div>
                            Decryption Process
                          </div>
                          <ul className="list-disc list-inside ml-7 space-y-1 text-purple-100">
                            <li>RSA private key decrypts the AES key</li>
                            <li>The recovered AES key decrypts the file</li>
                            <li>Original file is perfectly restored</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-900/50 to-slate-800/50 rounded-xl p-5 border border-indigo-500/30">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-indigo-400" />
                        Security Features
                      </h3>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <div className="text-green-400 font-semibold text-sm mb-1">✓ RSA-2048 OAEP</div>
                          <div className="text-xs text-purple-200">Industry-standard asymmetric encryption</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <div className="text-green-400 font-semibold text-sm mb-1">✓ AES-256-GCM</div>
                          <div className="text-xs text-purple-200">Military-grade symmetric encryption</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <div className="text-green-400 font-semibold text-sm mb-1">✓ Random IV</div>
                          <div className="text-xs text-purple-200">Unique initialization vector per file</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <div className="text-green-400 font-semibold text-sm mb-1">✓ Web Crypto API</div>
                          <div className="text-xs text-purple-200">Native browser cryptography</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <div className="text-green-400 font-semibold text-sm mb-1">✓ Zero Knowledge</div>
                          <div className="text-xs text-purple-200">Keys never leave your device</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <div className="text-green-400 font-semibold text-sm mb-1">✓ No Server Storage</div>
                          <div className="text-xs text-purple-200">100% client-side processing</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-900/50 to-slate-800/50 rounded-xl p-5 border border-green-500/30">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <Info className="w-5 h-5 text-green-400" />
                        Why Hybrid Encryption?
                      </h3>
                      <p className="text-purple-100 text-sm leading-relaxed">
                        Hybrid encryption combines the <span className="text-green-400 font-semibold">speed of symmetric encryption (AES)</span> for 
                        large files with the <span className="text-blue-400 font-semibold">security of asymmetric encryption (RSA)</span> for 
                        key exchange. This is the same proven approach used by HTTPS, TLS, PGP, and secure messaging apps like Signal!
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-amber-900/50 to-slate-800/50 rounded-xl p-5 border border-amber-500/30">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-400" />
                        Important Notes
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-purple-100">
                        <li>Keep your private key secure - anyone with it can decrypt your files</li>
                        <li>This is a demonstration tool - for production use, implement proper key management</li>
                        <li>All processing happens in your browser - no data is sent to any server</li>
                        <li>Keys are stored in memory only and cleared when you refresh the page</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Panel */}
            {status.message && (
              <div className={`rounded-xl p-4 border-2 transition-all ${
                status.type === 'error' ? 'bg-red-900/30 border-red-500' :
                status.type === 'success' ? 'bg-green-900/30 border-green-500' :
                'bg-blue-900/30 border-blue-500'
              }`}>
                <div className="flex items-start gap-3">
                  {status.type === 'error' ? <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-400" /> :
                   status.type === 'success' ? <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-400" /> :
                   <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-400" />}
                  <div className="flex-1">
                    <div className="font-semibold mb-1 text-sm">
                      {status.type === 'error' ? 'Error' : status.type === 'success' ? 'Success' : 'Status'}
                    </div>
                    <div className="text-sm break-words">{status.message}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Processing Indicator */}
            {processing && (
              <div className="bg-gradient-to-br from-purple-900/50 to-slate-800/50 rounded-xl p-5 border border-purple-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-semibold text-white">Processing...</span>
                </div>
                <p className="text-purple-200 text-sm">Please wait while we process your request securely.</p>
              </div>
            )}

            {/* History */}
            {encryptionHistory.length > 0 && (
              <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-5 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold text-white">Recent Activity</h3>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {encryptionHistory.map((item) => (
                    <div key={item.id} className="bg-slate-700/50 rounded-lg p-3 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-purple-400" />
                        <span className="text-white text-sm font-semibold truncate flex-1">{item.fileName}</span>
                      </div>
                      <div className="flex justify-between text-xs text-purple-300">
                        <span>{formatFileSize(item.fileSize)}</span>
                        <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-5 border border-purple-500/30">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                Security Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Key Strength</span>
                  <span className="text-white font-semibold">2048-bit</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Encryption</span>
                  <span className="text-white font-semibold">256-bit</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Files Encrypted</span>
                  <span className="text-white font-semibold">{encryptionHistory.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Keys Active</span>
                  <span className="text-white font-semibold">{(rsaKeyPair ? 1 : 0) + (aesKey ? 1 : 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-purple-300 text-sm">
          <p className="mb-2">🔐 Secure File Transfer Protocol - Educational Demonstration</p>
          <p className="text-xs text-purple-400">
            Built with Web Crypto API • RSA-2048 • AES-256-GCM • Zero-Knowledge Architecture
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;