export const cloneArray = <T>(t: T[]): T[] => {
    const new_arr: T[] = [];
    t.forEach(val => new_arr.push(Object.assign({}, val)));
    return new_arr;
}

export const cloneObject = <T>(t: T): T => {
    return Object.assign({}, t);
}