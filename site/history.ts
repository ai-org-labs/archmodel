/** Document history is separate from native text-field undo and view state. */
export class DocumentHistory {
 private past:string[]=[];
 private future:string[]=[];
 constructor(public current:string,private limit=100){}
 get canUndo(){return this.past.length>0;}
 get canRedo(){return this.future.length>0;}
 record(source:string){if(source===this.current)return;this.past.push(this.current);if(this.past.length>this.limit)this.past.shift();this.current=source;this.future=[];}
 undo(){if(!this.canUndo)return this.current;this.future.push(this.current);this.current=this.past.pop()!;return this.current;}
 redo(){if(!this.canRedo)return this.current;this.past.push(this.current);this.current=this.future.pop()!;return this.current;}
}
