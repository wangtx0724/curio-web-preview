const assert = require("node:assert/strict");
const CurioModel = require("../app.js");

function makeStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    }
  };
}

const created = CurioModel.createIdea("  第一条灵感  ", {
  id: "idea-1",
  createdAt: "2026-07-03T03:00:00.000Z",
  random: 0.2
});

assert.equal(created.content, "第一条灵感");
assert.equal(created.favorite, false);
assert.equal(created.export.markdownReady, true);
assert.equal(created.export.obsidianPath, null);
assert.equal(created.ai.curatorNote, null);
assert.equal(CurioModel.createIdea("   "), null);

const added = CurioModel.addIdea([], "夜里想到的句子", {
  id: "idea-2",
  createdAt: "2026-07-03T03:01:00.000Z",
  random: 0.8
});
assert.equal(added.ideas.length, 1);
assert.equal(added.idea.id, "idea-2");

const updated = CurioModel.updateIdea(added.ideas, "idea-2", "改写后的句子", "2026-07-03T03:02:00.000Z");
assert.equal(updated[0].content, "改写后的句子");
assert.equal(updated[0].updatedAt, "2026-07-03T03:02:00.000Z");

const favorite = CurioModel.toggleFavorite(updated, "idea-2");
assert.equal(favorite[0].favorite, true);
assert.equal(CurioModel.searchIdeas(favorite, "改写", false).length, 1);
assert.equal(CurioModel.searchIdeas(favorite, "不存在", false).length, 0);
assert.equal(CurioModel.searchIdeas(favorite, "", true).length, 1);

const storage = makeStorage();
CurioModel.saveIdeas(storage, favorite);
const loaded = CurioModel.loadIdeas(storage);
assert.deepEqual(loaded[0].content, "改写后的句子");
assert.equal(loaded[0].export.markdownReady, true);

const emptyStorage = makeStorage();
const samples = CurioModel.getInitialIdeas(emptyStorage);
assert.equal(samples.length, 7);
assert.equal(samples[0].id, "sample-product-1");
assert.equal(samples[0].export.markdownReady, true);

const existingStorage = makeStorage();
CurioModel.saveIdeas(existingStorage, favorite);
assert.equal(CurioModel.getInitialIdeas(existingStorage).length, 1);

const clearedStorage = makeStorage();
CurioModel.saveIdeas(clearedStorage, []);
assert.equal(CurioModel.getInitialIdeas(clearedStorage).length, 0);

const randomIdea = CurioModel.getRandomIdea([
  { id: "a" },
  { id: "b" }
], 0.75);
assert.equal(randomIdea.id, "b");
assert.equal(CurioModel.getRandomIdea([]), null);
assert.equal(CurioModel.mergeTranscript("", "  语音想到的句子 "), "语音想到的句子");
assert.equal(CurioModel.mergeTranscript("已有文字", "新的语音"), "已有文字\n新的语音");
assert.equal(CurioModel.mergeTranscript("已有文字", "   "), "已有文字");

const removed = CurioModel.deleteIdea(favorite, "idea-2");
assert.equal(removed.length, 0);

console.log("Curio model tests passed");
