import React from "react";
import ReactFullpage from "@fullpage/react-fullpage";
import FirstPage from "./pages/first/FirstPage";
import MouseScrollIcon from "../components/MouseScrollIcon";

const anchors = ["firstPage", "secondPage", "thirdPage"];

function Container() {
  const [isLast, setIsLast] = React.useState(false);

  return (
    <>
      <ReactFullpage
        menu
        anchors={anchors}
        navigation
        navigationTooltips={anchors}
        onLeave={(origin, destination) => {
          setIsLast(!!destination?.isLast);
        }}
        credits={{ enabled: false }}
        sectionsColor={["#ff5f45", "#0798ec"]}
        render={() => (
          <ReactFullpage.Wrapper>
            <div className="section">
              <FirstPage />
            </div>
            <div className="section">
              <div className="bg-amber-50">Section 2</div>
            </div>
          </ReactFullpage.Wrapper>
        )}
      />
      {!isLast && <MouseScrollIcon />}
    </>
  );
}

export default Container;
