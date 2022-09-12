import React from "react";
import Lottie from "react-lottie";
import * as animationData from "./json/smartsharp-animations.json";

const defaultOptions = {
  loop: true,
  autoplay: true,
  animationData: animationData.default,
  rendererSettings: {
    preserveAspectRatio: "xMidYMid slice",
  },
};

class LottieControl extends React.Component {
  render() {
    return (
      <div
        style={{
          padding: "1em",
        }}
      >
        <Lottie options={defaultOptions} height={window.innerHeight} />
      </div>
    );
  }
}

export default LottieControl;
