import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  replyText: {
    type: String,
    set: function(val) {
      if (val && typeof val === 'object' && val.detectedLanguage) {
        this.detectedLanguage = val.detectedLanguage;
      }
      return val;
    }
  },
  detectedLanguage: {
    type: String
  }
});

const TestModel = mongoose.model('TestModel', testSchema);

async function run() {
  const replyObj = new String("This is a warm response.");
  replyObj.detectedLanguage = "Tamil";

  const doc = new TestModel({
    replyText: replyObj
  });

  console.log("replyText:", doc.replyText);
  console.log("detectedLanguage:", doc.detectedLanguage);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
