import mongoose from 'mongoose';

const { Schema } = mongoose;

const SiteContent = mongoose.model(
  'SiteContent',
  new Schema(
    { key: { type: String, required: true, unique: true }, data: { type: Schema.Types.Mixed, default: {} } },
    { timestamps: true, minimize: false },
  ),
);

const Project = mongoose.model(
  'Project',
  new Schema(
    {
      slug: { type: String, required: true, unique: true, trim: true },
      order: { type: Number, default: 0 },
      name: { type: String, required: true },
      category: String,
      tags: [String],
      title: String,
      description: String,
      stat: String,
      status: String,
      highlights: [String],
      liveUrl: { type: String, default: '' },
      sourceUrl: { type: String, default: '' },
      image: { type: String, default: '' },
      sprite: String,
      bg: String,
    },
    { timestamps: true },
  ),
);

const Message = mongoose.model(
  'Message',
  new Schema(
    {
      name: { type: String, maxlength: 80, default: '' },
      email: { type: String, required: true, maxlength: 200 },
      message: { type: String, required: true, maxlength: 4000 },
      ip: String,
      ua: String,
      read: { type: Boolean, default: false },
    },
    { timestamps: true },
  ),
);

const scoreSchema = new Schema(
  {
    initials: { type: String, required: true, match: /^[A-Z0-9]{3}$/ },
    points: { type: Number, required: true, min: 0 },
    gf: { type: Number, required: true, min: 0 },
    ga: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);
scoreSchema.index({ points: -1, createdAt: 1 });
const Score = mongoose.model('Score', scoreSchema);

const Counter = mongoose.model('Counter', new Schema({ _id: String, value: { type: Number, default: 0 } }));

const projectFields = (p, i) => ({
  slug: p.slug,
  order: i,
  name: p.name,
  category: p.category,
  tags: p.tags || [],
  title: p.title,
  description: p.description,
  stat: p.stat || '',
  status: p.status || '',
  highlights: p.highlights || [],
  liveUrl: p.liveUrl || '',
  sourceUrl: p.sourceUrl || '',
  image: p.image || '',
  sprite: p.sprite || 'gem',
  bg: p.bg || '#0A0A0A',
});

export async function createMongoStore(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3500 });

  return {
    mode: 'mongo',

    async getContent() {
      const [site, projects] = await Promise.all([
        SiteContent.findOne({ key: 'site' }).lean(),
        Project.find().sort({ order: 1 }).lean(),
      ]);
      const data = site?.data || {};
      return {
        ...data,
        projects: projects.map(({ _id, __v, createdAt, updatedAt, order, ...p }) => p),
      };
    },

    async seed(content, { force = false } = {}) {
      const exists = await SiteContent.exists({ key: 'site' });
      if (exists && !force) return false;
      const { projects = [], ...site } = content;
      await SiteContent.findOneAndUpdate({ key: 'site' }, { key: 'site', data: site }, { upsert: true });
      await Project.deleteMany({});
      if (projects.length) await Project.insertMany(projects.map(projectFields));
      return true;
    },

    async addMessage(msg) {
      await Message.create(msg);
    },

    async listMessages(limit = 50) {
      const rows = await Message.find().sort({ createdAt: -1 }).limit(limit).lean();
      return rows.map(({ _id, __v, ip, ...m }) => ({ id: String(_id), ...m }));
    },

    async topScores(limit = 10) {
      const rows = await Score.find().sort({ points: -1, createdAt: 1 }).limit(limit).lean();
      return rows.map(({ initials, points, gf, ga, createdAt }) => ({ initials, points, gf, ga, createdAt }));
    },

    async addScore(score) {
      await Score.create(score);
      const rank = (await Score.countDocuments({ points: { $gt: score.points } })) + 1;
      return { rank };
    },

    async incrementVisits() {
      const doc = await Counter.findOneAndUpdate({ _id: 'visits' }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' });
      return doc.value;
    },

    async getVisits() {
      return (await Counter.findById('visits').lean())?.value || 0;
    },

    async close() {
      await mongoose.disconnect();
    },
  };
}
