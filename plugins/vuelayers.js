import Vue from "vue";
import VueLayers from "vuelayers";
import "vuelayers/dist/vuelayers.css";

import FullScreen from "ol/control/FullScreen";

export default (context, inject) => {
  const ol = {
    FullScreen,
  };
  inject("ol", ol);
};

Vue.use(VueLayers);
