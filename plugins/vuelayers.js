import Vue from "vue";
import VueLayers from "vuelayers";
import "vuelayers/dist/vuelayers.css";

import FullScreen from "ol/control/FullScreen";
import Circle from "ol/style/Circle";
import RegularShape from "ol/style/RegularShape";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import Text from "ol/style/Text";





export default (context, inject) => {
  const ol = {
    FullScreen,
    Circle,
    Style,
    Stroke,
    Text,
    Fill,
    RegularShape
  };
  inject("ol", ol);
};

Vue.use(VueLayers);
