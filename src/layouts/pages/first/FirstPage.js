import React from "react";
import LeftContent from "./LeftContent";
import RightContent from "./RightContent";

function FirstPage() {
  return (
    <>
      <div className="grid grid-cols-12 h-screen">
        <LeftContent />
        <RightContent />
      </div>
    </>
  );
}

export default FirstPage;
