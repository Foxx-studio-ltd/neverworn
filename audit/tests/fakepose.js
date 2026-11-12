// Test double for the TF.js + MoveNet CDN bundles (jsDelivr is not reachable from CI sandboxes and real pose output is non-deterministic).
// Stand-in for the tf.js + pose-detection CDN bundles: deterministic keypoints of a ~170cm person.
window.tf=window.tf||{setBackend:async()=>true,ready:async()=>true};
window.poseDetection=window.poseDetection||{SupportedModels:{MoveNet:'m'},movenet:{modelType:{SINGLEPOSE_THUNDER:'t'}},
 createDetector:async()=>({estimatePoses:async()=>{const P={nose:[320,100],left_shoulder:[380,220],right_shoulder:[260,220],left_elbow:[400,360],right_elbow:[240,360],left_wrist:[410,480],right_wrist:[230,480],left_hip:[360,480],right_hip:[280,480],left_knee:[355,680],right_knee:[285,680],left_ankle:[350,880],right_ankle:[290,880]};
  return [{keypoints:Object.entries(P).map(([name,[x,y]])=>({name,x,y,score:.9}))}]}})};
