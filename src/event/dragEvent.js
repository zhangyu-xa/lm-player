import React from "react";
import { videoDec } from "../context";
import { computedBound } from "../util";

@videoDec
class DragEvent extends React.Component {
  constructor(props) {
    super(props);
    const { playContainer } = props;

    this.dragDom = playContainer.querySelector(".player-mask-layout");
    this.position = {
      start: [0, 0],
      end: [0, 0]
    };
  }
  componentDidMount() {
    const { isDraggable } = this.props.playerProps;
    if (isDraggable) {
      this.dragDom.addEventListener("mousedown", this.openDrag);
      this.props.event.addEventListener("transform", this.transformChange, true);
    }
  }
  componentWillUnmount() {
    this.dragDom.removeEventListener("mousedown", this.openDrag);
    this.props.event.removeEventListener("transform", this.transformChange);
  }
  openDrag = e => {
    this.position.start = [e.pageX, e.pageY];
    this.dragDom.addEventListener("mousemove", this.moveChange);
    this.dragDom.addEventListener("mouseup", this.stopDrag);
  };
  moveChange = e => {
    const { api } = this.props;
    const currentPosition = api.getPosition();
    this.position.end = [e.pageX, e.pageY];
    const x = currentPosition[0] + (this.position.end[0] - this.position.start[0]);
    const y = currentPosition[1] + (this.position.end[1] - this.position.start[1]);
    const position = [x, y];
    api.setPosition(position);
    this.position.start = [e.pageX, e.pageY];
  };
  stopDrag = () => {
    this.dragDom.removeEventListener("mousemove", this.moveChange);
    this.dragDom.removeEventListener("mouseup", this.stopDrag);
    this.transformChange();
  };
  transformChange = () => {
    const { api } = this.props;
    let position = computedBound(this.dragDom, api.getPosition(), api.getScale());
    position && api.setPosition(position, true);
  };

  render() {
    return null;
  }
}
export default DragEvent;
