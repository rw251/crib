const topics = {};
let subUid = -1;
const overriden = {};

const overwrite = (topic, func) => {
  overriden[topic] = func;
};
const revert = (topic) => {
  delete overriden[topic];
};

const subscribe = (topic, func) => {
  if (!topics[topic]) {
    topics[topic] = [];
  }
  const token = (++subUid).toString();
  topics[topic].push({
    token,
    func,
  });
  return token;
};

const publish = (topic, args) => {
  if (!topics[topic]) {
    return false;
  }
  if (overriden[topic]) {
    setTimeout(() => {
      overriden[topic](args);
    }, 0);
    return true;
  }
  setTimeout(() => {
    const subscribers = topics[topic];
    let len = subscribers ? subscribers.length : 0;

    while (len--) {
      subscribers[len].func(args);
    }
  }, 0);
  return true;
};
export { publish, subscribe, overwrite, revert };
