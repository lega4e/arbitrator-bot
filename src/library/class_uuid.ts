import { v4 as uuidv4 } from 'uuid';

export function ClassUuid() {
  return function(target: any) {
    target.prototype.classUuid = uuidv4();
  };
}

export function getClassUuid(target: any) {
  return target.prototype.classUuid;
}