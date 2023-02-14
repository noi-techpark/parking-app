import Vue from "vue";
import VueLayers from "vuelayers";
import "vuelayers/dist/vuelayers.css";

import FullScreen from "ol/control/FullScreen";
import Circle from "ol/style/Circle";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";




export default (context, inject) => {
  const ol = {
    FullScreen,
    Circle,
    Style,
    Stroke
  };
  inject("ol", ol);
};

Vue.use(VueLayers);
