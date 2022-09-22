import React from "react";
import styled from "styled-components";

const ScrollDowns = styled.div`
  width: 34px;
  height: 40px;

  .mousey {
    width: 3px;
    height: 20px;
    border: 2px solid #fff;
  }
  .scroller {
    width: 3px;
    height: 10px;
    border-radius: 25%;
    animation: scroll 2.2s cubic-bezier(0.15, 0.41, 0.69, 0.94) infinite;
  }
  @keyframes scroll {
    0% {
      opacity: 0;
    }
    10% {
      transform: translateY(0);
      opacity: 1;
    }
    100% {
      transform: translateY(15px);
      opacity: 0;
    }
  }
`;

function MouseScrollIcon() {
  return (
    <ScrollDowns className="absolute inset-x-0 bottom-7 m-auto mix-blend-difference">
      <div className="mousey p-2.5 rounded-3xl opacity-75 box-content m-auto">
        <div className="scroller bg-white" />
      </div>
    </ScrollDowns>
  );
}

export default MouseScrollIcon;
