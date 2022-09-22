import React from "react";
import SocialLink from "../../../components/SocialLink";

function RightContent() {
  return (
    <div className="bg-cyan-200 sm:col-span-12 md:col-span-4 p-7">
      <div className="absolute bottom-7 right-7">
        <SocialLink />
      </div>
    </div>
  );
}

export default RightContent;
