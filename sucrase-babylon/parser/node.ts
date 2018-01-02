import {Comment, Node as NodeType, NodeBase} from "../types";
import {Position, SourceLocation} from "../util/location";
import Parser from "./index";
import UtilParser from "./util";

// Start an AST node, attaching a start offset.

const commentKeys = ["leadingComments", "trailingComments", "innerComments"];

class Node implements NodeBase {
  constructor(parser: Parser, pos: number, loc: Position) {
    this.type = "";
    this.start = pos;
    this.end = 0;
    this.loc = new SourceLocation(loc);
    if (parser && parser.options.ranges) this.range = [pos, 0];
    if (parser && parser.filename) this.loc.filename = parser.filename;
  }

  type: string;
  start: number;
  end: number;
  loc: SourceLocation;
  range: [number, number];
  leadingComments: Array<Comment> | null;
  trailingComments: Array<Comment> | null;
  innerComments: Array<Comment> | null;
  extra: {[key: string]: {}};

  __clone(): this {
    // @ts-ignore
    const node2: this = new Node();
    Object.keys(this).forEach((key) => {
      // Do not clone comments that are already attached to the node
      if (commentKeys.indexOf(key) < 0) {
        // $FlowIgnore
        node2[key] = this[key];
      }
    });

    return node2;
  }
}

export class NodeUtils extends UtilParser {
  startNode<T extends NodeType>(): T {
    // @ts-ignore
    return new Node(this, this.state.start, this.state.startLoc);
  }

  startNodeAt<T extends NodeType>(pos: number, loc: Position): T {
    // @ts-ignore
    return new Node(this, pos, loc);
  }

  /** Start a new node with a previous node's location. */
  startNodeAtNode<T extends NodeType>(type: NodeType): T {
    return this.startNodeAt(type.start, type.loc.start);
  }

  // Finish an AST node, adding `type` and `end` properties.

  finishNode<T extends NodeType>(node: T, type: string): T {
    return this.finishNodeAt(node, type, this.state.lastTokEnd, this.state.lastTokEndLoc);
  }

  // Finish node at given position

  finishNodeAt<T extends NodeType>(node: T, type: string, pos: number, loc: Position): T {
    node.type = type;
    node.end = pos;
    node.loc.end = loc;
    if (this.options.ranges) node.range[1] = pos;
    this.processComment(node);
    return node;
  }

  /**
   * Reset the start location of node to the start location of locationNode
   */
  resetStartLocationFromNode(node: NodeBase, locationNode: NodeBase): void {
    node.start = locationNode.start;
    node.loc.start = locationNode.loc.start;
    if (this.options.ranges) node.range[0] = locationNode.range[0];
  }
}
