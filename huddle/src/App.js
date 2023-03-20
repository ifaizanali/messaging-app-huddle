import './App.css';
import React, {useEffect, useRef, useState} from 'react';
import Peer from "peerjs";
import {io} from "socket.io-client";
import axios from "axios";
import videoFile from "./video.mp4"

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const room = searchParams.get('room');
  const user = localStorage.getItem('userId')
  const [audio, setAudio] =  useState(true)
  const [video, setVideo] =  useState(false)
  const [screen, setScreen] =  useState(false)
  const [videoShares, setVideoShares] = useState([])
  const [screenShares, setScreenShares] = useState([])
  let myAudioRef = useRef(null);
  let myVideoRef = useRef(null);
  let myScreenRef = useRef(null);
  let mediaRef = useRef(null);
  let peerRef = useRef(null);
  const [calls, setCalls] = useState([])
  const callRef = React.useRef(null)
  callRef.current = calls
  const socketRef = useRef(null)
  const getScreenRef = React.useRef(null)
  getScreenRef.current = videoShares
  const getSScreenRef = React.useRef(null)
  getSScreenRef.current = screenShares


  useEffect(async () => {
    socketRef.current = io("http://localhost:5000");

    await axios.get(`http://localhost:5000/stop-video/${room}/${user}`).then(res => {
    })

    await axios.get(`http://localhost:5000/get-video/${room}`).then(res => {
      setVideoShares(res.data.users)
    })

    await axios.get(`http://localhost:5000/stop-screen/${room}/${user}`).then(res => {
    })

    await axios.get(`http://localhost:5000/get-screen/${room}`).then(res => {
      setScreenShares(res.data.users)
    })

    const peer = new Peer(user, {
      host: "/",
      port: 3002,
      path: "/",
      pingInterval: 5000
    });

    peerRef.current = peer

    peer.on('open', async id => {
      localStorage.setItem('userId', id)
      await getAudio();
      await startCall(myAudioRef.current)
      socketRef.current.emit('join-room', room, id)
    })

    socketRef.current.on('user-disconnected', userId => {
      peerRef.current.connections[userId][0].close();
      const arr = [...calls]
      const arr1 = []
      arr.forEach(i => {
        if (i.peer !== userId)
          arr1.push(i)
      })
      setCalls(arr1)
    })

    socketRef.current.on('video-disconnected', userId => {
      if(document.getElementById(`${userId}-video`))
      document.getElementById('video-grid').removeChild(document.getElementById(`${userId}-video`))
    })

    socketRef.current.on('screen-disconnected', userId => {
      if(document.getElementById(`${userId}-screen`))
      document.getElementById('video-grid').removeChild(document.getElementById(`${userId}-screen`))
    })

    socketRef.current.on('share-video', async userId => {
      const myVideo = document.createElement('video')
      myVideo.id = `${userId}-video`
      let count = 0
      callRef.current.forEach(i => {
        if (i.peer === userId && count === 0) {
          const ms = new MediaStream([i.peerConnection.getReceivers()[1].track])
          addVideoStream(myVideo, ms)
          count++
        }
      })
    })

    socketRef.current.on('share-screen', async userId => {
      const myVideo = document.createElement('video')
      myVideo.id = `${userId}-screen`
      let count = 0
      callRef.current.forEach(i => {
        if (i.peer === userId && count === 0) {
          const ms = new MediaStream([i.peerConnection.getReceivers()[2].track])
          addVideoStream(myVideo, ms)
          count++
        }
      })
    })

  }, [])


  function connectToNewUser(userId, stream) {
    const call = peerRef.current.call(userId, stream)
    if(myVideoRef.current !== null)
    {
      const ms = myVideoRef.current.getVideoTracks()[0]
      let sender = call.peerConnection.getSenders()[1]
      sender.replaceTrack(ms)
    }
    if(myScreenRef.current !== null)
    {
      const ms = myScreenRef.current.getVideoTracks()[0]
      let sender = call.peerConnection.getSenders()[2]
      sender.replaceTrack(ms)
    }
    const audio = document.createElement('audio');
    call.on('stream', userVideoStream => {
      setCalls(old => [...old, call])
      addAudioStream(audio, userVideoStream)
    })
    call.on('close', () => {
      audio.remove()
    })
  }

  async function startCall(stream){
    const ms = stream.clone()
    const s = document.getElementById('sample').captureStream(24)
    const track = s.getVideoTracks()[0].clone()
    const track1 = s.getVideoTracks()[0].clone()
    ms.addTrack(track);
    ms.addTrack(track1);
    mediaRef.current = ms
    peerRef.current.on('call',  call => {
      call.answer(ms)
      const audio = document.createElement('audio');
      const visited = []
      const visited1 = []
      call.on('stream', async userVideoStream => {
        setCalls(old => [...old, call])
        audio.id = `${call.peer}-audio`
        addAudioStream(audio, userVideoStream)
        getScreenRef.current.forEach(k => {
          if(k === call.peer && !visited.includes(k))
          {
            const video = document.createElement('video')
            video.id = `${call.peer}-video`
            const ms = new MediaStream([call.peerConnection.getReceivers()[1].track])
            addVideoStream(video, ms)
            visited.push(k)
          }
        })
        getSScreenRef.current.forEach(k => {
          if(k === call.peer && !visited1.includes(k))
          {
            const video = document.createElement('video')
            video.id = `${call.peer}-screen`
            const ms = new MediaStream([call.peerConnection.getReceivers()[2].track])
            addVideoStream(video, ms)
            visited1.push(k)
          }
        })
      })
      call.on('close', () => {
        audio.remove()
      })
    })

    socketRef.current.on('user-connected', userId => {
      connectToNewUser(userId, ms)
    })
  }


  async function startVideo(){
    await axios.get(`http://localhost:5000/start-video/${room}/${user}`).then(res => {
    })
    await navigator.mediaDevices.getUserMedia({video: true}).then(stream => {
      myVideoRef.current = stream;
      const video = document.createElement('video')
      video.id = `${user}-video`
      addVideoStream(video, myVideoRef.current)
      const visited = []
      callRef.current.forEach(i => {
        if (!visited.includes(i.peer))
        {
          let sender = i.peerConnection.getSenders()[1]
          sender.replaceTrack(stream.getVideoTracks()[0])
          visited.push(i.peer)
        }
      })

    })
    socketRef.current.emit('start-video-share', room, user)
  }


  async function startScreen(){
    await axios.get(`http://localhost:5000/start-screen/${room}/${user}`).then(res => {
    })
    await navigator.mediaDevices.getDisplayMedia().then(stream => {
      myScreenRef.current = stream;
      const video = document.createElement('video')
      video.id = `${user}-screen`
      addVideoStream(video, myScreenRef.current)
      const visited = []
      callRef.current.forEach(i => {
        if (!visited.includes(i.peer))
        {
          let sender = i.peerConnection.getSenders()[2]
          sender.replaceTrack(stream.getVideoTracks()[0])
          visited.push(i.peer)
        }
      })
      socketRef.current.emit('start-screen-share', room, user)
    })
  }


  async function getAudio(){
    myAudioRef.current = await window.navigator.mediaDevices.getUserMedia({audio: true});
  }

  function addAudioStream(audio, stream){
    const newStream = new MediaStream()
    newStream.addTrack(stream.getAudioTracks()[0].clone())
    audio.srcObject = newStream
    audio.addEventListener('loadedmetadata', () => {
      audio.play();
    })
  }

  function addVideoStream(video, stream){
    const newStream = new MediaStream()
    newStream.addTrack(stream.getVideoTracks()[0])
    video.srcObject = newStream
    video.addEventListener('loadedmetadata', () => {
      video.play();
    })
    document.getElementById('video-grid').append(video)
  }

  function toggleAudio(){
    mediaRef.current.getAudioTracks()[0].enabled = !audio;
    setAudio(!audio)
  }

  async function toggleVideo(){
    if(video)
    {
      await myVideoRef.current.getTracks().forEach(track => track.stop());
      document.getElementById('video-grid').removeChild(document.getElementById(`${user}-video`))
      socketRef.current.emit('stop-video-share', room, peerRef.current.id);
      myVideoRef.current = null;
      await axios.get(`http://localhost:5000/stop-video/${room}/${user}`).then(res => {
      })
    }
    else{
      await startVideo()
    }
    setVideo(!video)
  }


  async function toggleScreen(){
    if(screen)
    {
      await myScreenRef.current.getTracks().forEach(track => track.stop());
      document.getElementById('video-grid').removeChild(document.getElementById(`${user}-screen`))
      socketRef.current.emit('stop-screen-share', room, peerRef.current.id);
      myScreenRef.current = null;
      await axios.get(`http://localhost:5000/stop-screen/${room}/${user}`).then(res => {
      })
    }
    else{
      await startScreen()
    }
    setScreen(!screen)
  }

  return (
      <div className="App">
        <div>
          <video type="video/mp4" id={'sample'} src={videoFile}></video>
          <div id='video-grid'></div>
          <button onClick={toggleAudio}>{audio ? "Mute" : "Un Mute"}</button>
          <button onClick={toggleVideo}>{video ? "Stop Video" : "Start Video"}</button>
          <button onClick={toggleScreen}>{screen ? "Stop Screen" : "Start Screen"}</button>
        </div>
      </div>
  );
}

export default App;
