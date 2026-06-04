import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>*{margin:0;padding:0;}body{background:#000;}canvas{display:block;}</style>
</head>
<body>
  <canvas id="c" width="224" height="224"></canvas>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js"></script>
  <script>
    function rn(d){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(d));}
    window.onerror=function(m,s,l){rn({type:'ERROR',msg:m+' L'+l});};
    var c=document.getElementById('c'),ctx=c.getContext('2d');
    function dist(a,b){return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2);}
    function ear(lm,i){return(dist(lm[i[1]],lm[i[5]])+dist(lm[i[2]],lm[i[4]]))/(2*dist(lm[i[0]],lm[i[3]])+1e-6);}
    function mar(lm){return dist(lm[13],lm[14])/(dist(lm[61],lm[291])+1e-6);}
    function emb(lm){
      var k=[1,4,5,6,8,10,13,14,17,21,33,37,40,46,52,53,54,55,58,61,63,65,66,67,70,78,80,81,82,84,87,88,91,93,95,103,105,107,109,127,132,133,136,144,145,146,148,149,150,152,153,154,155,157,158,159,160,161,162,163];
      var n=lm[1],e=[];
      for(var i=0;i<k.length&&e.length<128;i++)e.push(lm[k[i]].x-n.x,lm[k[i]].y-n.y);
      while(e.length<128)e.push(0);
      var s=Math.sqrt(e.reduce(function(a,v){return a+v*v;},0))||1;
      return e.map(function(v){return v/s;});
    }
    var LE=[362,385,387,263,373,380],RE=[33,160,158,133,153,144];
    var lastEAR=0.3,blinks=0,frames=0,ready=false,busy=false;
    function init(){
      if(typeof FaceMesh==='undefined'){rn({type:'ERROR',msg:'FaceMesh not loaded'});return;}
      var fm=new FaceMesh({locateFile:function(f){return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/'+f;}});
      fm.setOptions({maxNumFaces:1,refineLandmarks:false,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
      fm.onResults(function(res){
        busy=false;
        if(!res.multiFaceLandmarks||!res.multiFaceLandmarks.length){rn({type:'NO_FACE'});return;}
        var lm=res.multiFaceLandmarks[0];frames++;
        var avgEAR=(ear(lm,LE)+ear(lm,RE))/2,blink=false;
        if(lastEAR>0.20&&avgEAR<0.18){blinks++;blink=true;}
        lastEAR=avgEAR;
        var m=mar(lm);
        rn({type:'FACE_DATA',embedding:emb(lm),landmarks:{avgEAR:avgEAR,mar:m,blinkCount:blinks,blinkDetected:blink,smiling:m>0.08,frameCount:frames}});
      });
      window._fm=fm;ready=true;rn({type:'READY'});
    }
    window.addEventListener('load',function(){setTimeout(init,500);});
    setTimeout(function(){if(!ready)init();},3000);
    window.processFrame=function(b){
      if(!ready||!window._fm||busy)return;
      busy=true;
      var img=new Image();
      img.onload=function(){
        c.width=img.naturalWidth||224;c.height=img.naturalHeight||224;
        ctx.drawImage(img,0,0);
        window._fm.send({image:c}).catch(function(e){busy=false;rn({type:'ERROR',msg:e.message});});
      };
      img.onerror=function(){busy=false;rn({type:'ERROR',msg:'img fail'});};
      img.src='data:image/jpeg;base64,'+b;
    };
    window.resetBlink=function(){blinks=0;frames=0;};
  </script>
</body>
</html>`;

const FaceProcessor = forwardRef(function({onFaceData, onReady}, ref) {
  var webViewRef = useRef(null);
  useImperativeHandle(ref, function() {
    return {
      sendFrame: function(base64) {
        if(webViewRef.current)
          webViewRef.current.injectJavaScript('window.processFrame('+JSON.stringify(base64)+');true;');
      },
      resetBlink: function() {
        if(webViewRef.current)
          webViewRef.current.injectJavaScript('window.resetBlink();true;');
      },
    };
  });
  function handleMsg(e) {
    try {
      var d = JSON.parse(e.nativeEvent.data);
      if(d.type!=='NO_FACE') console.log('🤖 WebView:',d.type,d.msg||'');
      if(d.type==='READY'&&onReady) onReady();
      else if(d.type==='ERROR') console.error('❌',d.msg);
      else if(onFaceData) onFaceData(d);
    } catch(err) { console.log('parse err:',err.message); }
  }
  return (
    <View style={{width:1,height:1,position:'absolute',opacity:0}}>
      <WebView
        ref={webViewRef}
        source={{html:HTML}}
        onMessage={handleMsg}
        javaScriptEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        domStorageEnabled={true}
        cacheEnabled={true}
        onError={function(e){console.error('WV err:',e.nativeEvent);}}
      />
    </View>
  );
});

export default FaceProcessor;
