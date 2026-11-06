const WEIGHT = { Critical: 100, Medium: 50, Low: 10 };

// priority_score = وزن الخطورة + (عدد المصابين × 5) + دقايق الانتظار
function score(r) {
  const waited = Math.floor((Date.now() - new Date(r.created_at)) / 60000);
  return WEIGHT[r.severity] + r.injured_count * 5 + waited;
}

// الأعلى في الـ score يطلع الأول، ولو متساويين الأقدم يطلع الأول
function isHigher(x, y) {
  if (x.score !== y.score) return x.score > y.score;
  return new Date(x.created_at) < new Date(y.created_at);
}

class MaxHeap {
  constructor() {
    this.a = [];
  }

  push(item) {
    this.a.push(item);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (!isHigher(this.a[i], this.a[p])) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }

  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.a.length && isHigher(this.a[l], this.a[m])) m = l;
        if (r < this.a.length && isHigher(this.a[r], this.a[m])) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
        i = m;
      }
    }
    return top;
  }

  get size() {
    return this.a.length;
  }
}

// بيرجّع نسخة مترتبة من البلاغات، وكل بلاغ معاه الـ score بتاعه.
// الـ Heap بيتبني من جديد في كل نداء لأن الـ score بيزيد مع الوقت.
function sortReports(reports) {
  const heap = new MaxHeap();
  reports.forEach((r) => heap.push({ ...r, score: score(r) }));
  const sorted = [];
  while (heap.size) sorted.push(heap.pop());
  return sorted;
}

module.exports = { score, isHigher, MaxHeap, sortReports };
