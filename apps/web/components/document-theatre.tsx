"use client";

import { FileCode2, FileText, ShieldCheck } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";

export function DocumentTheatre() {
  const { scrollYProgress } = useScroll();

  const y = useTransform(scrollYProgress, [0, 0.5], [0, -120]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5], [12, -4]);
  const rotateZ = useTransform(scrollYProgress, [0, 0.5], [-3, 5]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, filter: "blur(18px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="document-theatre"
    >
      <motion.div style={{ y, rotateX, rotateZ }} className="document-theatre-inner">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />

        <motion.div
          animate={{ y: [0, -18, 0], rotate: [-6, -3, -6] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="floating-card ubl-card"
        >
          <div className="floating-card-top">
            <FileText size={22} />
            <span>UBL</span>
          </div>

          <div className="card-lines">
            <span />
            <span />
            <span />
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 24, 0], rotate: [8, 4, 8] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="floating-card code-card"
        >
          <div className="floating-card-top">
            <FileCode2 size={24} />
            <span>Parse</span>
          </div>

          <div className="code-block">
            &lt;Invoice&gt;
            <br />
            &nbsp;&lt;ID&gt;FF-001&lt;/ID&gt;
            <br />
            &nbsp;&lt;TaxTotal&gt;...&lt;/TaxTotal&gt;
            <br />
            &lt;/Invoice&gt;
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, -14, 0], rotate: [0, 2, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          className="report-card"
        >
          <div className="report-card-head">
            <div>
              <p>Validation report</p>
              <h3>Review required</h3>
            </div>

            <div>
              <ShieldCheck size={25} />
            </div>
          </div>

          <div className="report-metrics">
            <Metric label="Technical" value="Failed" />
            <Metric label="Standard" value="Warning" />
            <Metric label="Legal" value="Simulation" />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
