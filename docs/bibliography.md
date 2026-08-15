# Wind Turbine Digital Twin — Aperture Bibliography

**IEEE-style citations with annotations**  
Subject areas: (1) Intro to Digital Transformations & Digital Twins · (2) ML for Modeling & Simulation · (3) Real-Time Simulation Modeling for DTs · (4) Integrated Applications (Project-based DT)

---

## A. Digital Twin Origins and Definitions

[1] M. W. Grieves, "Digital Twin: Manufacturing Excellence through Virtual Factory Replication," White Paper, Michael W. Grieves LLC, 2014. [Online]. Available: https://theengineer.markallengroup.com/production/content/uploads/2014/12/Digital_Twin_White_Paper_Dr_Grieves.pdf

> **Annotation:** Grieves' seminal white paper formalizes the "Digital Twin" term after first presenting the core concept at a Society of Manufacturing Engineers conference in 2002. It defines three foundational elements—physical product, virtual product, and bidirectional data/information connections—and argues that tightening this loop enables unprecedented quality management. This is the primary conceptual anchor for **Section 1** and the opening of every DT literature review.

[2] E. Glaessgen and D. Stargel, "The Digital Twin Paradigm for Future NASA and U.S. Air Force Vehicles," in *Proc. 53rd AIAA/ASME/ASCE/AHS/ASC Structures, Structural Dynamics and Materials Conf.*, Honolulu, HI, USA, Apr. 2012, doi: 10.2514/6.2012-1818. [Online]. Available: https://arc.aiaa.org/doi/10.2514/6.2012-1818

> **Annotation:** This landmark AIAA paper introduced the term "Digital Twin" to aerospace engineering, defining it as "an integrated multi-physics, multi-scale, probabilistic simulation of an as-built vehicle." It motivated NASA and the USAF to develop ultra-high-fidelity structural health management systems. A canonical reference for **Section 1** establishing why DTs need both physics-based models and real-time sensor updates.

[3] F. Tao, H. Zhang, A. Liu, and A. Y. C. Nee, "Digital Twin in Industry: State-of-the-Art," *IEEE Trans. Ind. Informat.*, vol. 15, no. 4, pp. 2405–2415, Apr. 2019, doi: 10.1109/TII.2018.2873186.

> **Annotation:** The most-cited comprehensive survey on DT in manufacturing (5000+ citations). Reviews DT components—physical, virtual, connection, data, and service—and surveys applications across product design, production, and maintenance. Introduces the five-dimension model and is the go-to state-of-the-art reference for **Sections 1 and 2**.

[4] F. Tao, Q. Qi, L. Wang, and A. Y. C. Nee, "Digital Twins and Cyber–Physical Systems toward Smart Manufacturing and Industry 4.0: Correlation and Comparison," *Engineering*, vol. 5, no. 4, pp. 653–661, 2019, doi: 10.1016/j.eng.2019.01.014. [Online]. Available: https://www.sciencedirect.com/science/article/pii/S2095809919300347

> **Annotation:** Tao et al. compare digital twins with cyber-physical systems (CPS), clarifying how DTs extend CPS by adding the service dimension, historical data integration, and the digital twin aggregate concept. Essential for **Section 1** when students need to position DT against adjacent Industry 4.0 paradigms.

[5] ISO, "Automation Systems and Integration — Digital Twin Framework for Manufacturing — Part 1: Overview and General Principles," International Standard ISO 23247-1, Oct. 2021. [Online]. Available: https://www.iso.org/standard/75066.html

> **Annotation:** The first international standard defining a reference architecture for manufacturing digital twins, specifying four functional domains: observable manufacturing elements, device communication, the DT core, and user interfaces. Provides the normative vocabulary and interoperability framework used throughout **Sections 1 and 4**.

---

## B. Digital Twin Taxonomies and Maturity

[6] W. Kritzinger, M. Karner, G. Traar, J. Henjes, and W. Sihn, "Digital Twin in Manufacturing: A Categorical Literature Review and Classification," *IFAC-PapersOnLine*, vol. 51, no. 11, pp. 1016–1022, 2018, doi: 10.1016/j.ifacol.2018.08.474. [Online]. Available: https://www.sciencedirect.com/science/article/pii/S2405896318316021

> **Annotation:** Introduces the widely adopted three-tier taxonomy distinguishing the *digital model* (no automated data flow), *digital shadow* (one-way: physical→digital), and *digital twin* (bidirectional automated connection). This classification is the starting point for maturity assessments in **Section 1** and determines the target capability level for the Aperture prototype.

[7] F. Tao, W. Liu, M. Zhang, T. Hu, Q. Qi, H. Zhang, F. Sui, T. Wang, H. Xu, et al., "Five-Dimension Digital Twin Model and Its Ten Applications," *Comput. Integr. Manuf. Syst.*, vol. 25, no. 1, pp. 1–18, 2019. [Online]. Available: https://scholar.google.com/citations?user=-LQGKncAAAAJ

> **Annotation:** Extends the classic three-part DT model by adding *data* and *service* dimensions to create the authoritative 5D DT framework (physical entity, virtual entity, DT data, connections, DT services). The paper then maps ten concrete industrial applications to this model. Central to **Section 1** when introducing DT architecture and to **Section 4** when positioning the wind turbine prototype.

[8] A. Fuller, Z. Fan, C. Day, and C. Barlow, "Digital Twin: Enabling Technologies, Challenges and Open Research," *IEEE Access*, vol. 8, pp. 108952–108971, 2020, doi: 10.1109/ACCESS.2020.2998358. [Online]. Available: https://arxiv.org/pdf/1911.01276

> **Annotation:** A broad enabling-technologies review covering AI/ML, IoT, cloud computing, and VR/AR as DT pillars, alongside a categorical taxonomy of published DT research across manufacturing, healthcare, and smart cities. This paper bridges **Sections 1 and 2**, providing students with the technology landscape before diving into specific ML methods.

---

## C. Machine Learning for Digital Twins

[9] A. Rasheed, O. San, and T. Kvamsdal, "Digital Twin: Values, Challenges and Enablers From a Modeling Perspective," *IEEE Access*, vol. 8, pp. 21980–22012, 2020, doi: 10.1109/ACCESS.2020.2970143. [Online]. Available: https://ui.adsabs.harvard.edu/abs/2020IEEEA...821980R

> **Annotation:** The most comprehensive treatment of DT modeling from first principles—covering reduced-order models, data assimilation, uncertainty quantification, and the full ML spectrum for surrogate construction. Defines a DT as "a virtual representation of a physical asset enabled through data and simulators for real-time prediction." The primary theoretical reference for **Section 2**, especially for surrogate model selection.

[10] M. Raissi, P. Perdikaris, and G. E. Karniadakis, "Physics-Informed Neural Networks: A Deep Learning Framework for Solving Forward and Inverse Problems Involving Nonlinear Partial Differential Equations," *J. Comput. Phys.*, vol. 378, pp. 686–707, 2019, doi: 10.1016/j.jcp.2018.10.045. [Online]. Available: https://neuralfields.cs.brown.edu/paper_4.html

> **Annotation:** Foundational paper introducing physics-informed neural networks (PINNs), which embed PDE residuals directly into the neural network loss function, enabling data-efficient surrogate models that respect physical laws. For wind turbine DTs, PINNs allow training on sparse SCADA data while preserving aerodynamic/structural constraints. Core reference for **Section 2** when covering hybrid data-physics modeling.

[11] D. Bertsimas and J. Dunn, "Optimal Classification Trees," *Mach. Learn.*, vol. 106, no. 7, pp. 1039–1082, 2017, doi: 10.1007/s10994-017-5633-9. [Online]. Available: https://dl.acm.org/doi/10.1007/s10994-017-5633-9

> **Annotation:** Presents the Optimal Classification Trees (OCT) algorithm, which formulates the entire decision tree as a single mixed-integer optimization (MIO) problem rather than using greedy top-down splitting. OCT produces interpretable rule-based classifiers that are globally optimal, achieving 1–5% accuracy improvements over CART on benchmarks. Justifies the rule-based fault classifier design in **Section 2** and **Section 4**.

[12] V. Garg, A. Kasiviswanathan, A. Sharma, and A. R. Verma, "Digital Twin and Artificial Intelligence Incorporated with Surrogate Modeling for Hybrid and Sustainable Energy Systems," *arXiv:2210.00073*, 2022. [Online]. Available: https://arxiv.org/pdf/2210.00073

> **Annotation:** Comprehensive framework review of AI-driven surrogate modeling for DTs in energy systems, covering Kriging, radial basis functions, support vector regression (SVR), and neural network surrogates. Explicitly maps surrogate types to DT fidelity levels and discusses uncertainty propagation. Supports **Section 2** when comparing KNN, SVR, and linear regression as power-curve surrogates.

[13] Q. Qi, F. Tao, T. Hu, N. Anwer, A. Liu, Y. Wei, L. Wang, and A. Y. C. Nee, "Enabling Technologies and Tools for Digital Twin," *J. Manuf. Syst.*, vol. 58, pp. 3–21, 2021, doi: 10.1016/j.jmsy.2019.10.001. [Online]. Available: https://www.sciencedirect.com/science/article/pii/S0278612519301608

> **Annotation:** Surveys enabling technologies for DT construction across six categories—modeling, simulation, IoT, big data, connectivity, and AI—detailing the roles of transfer learning, reinforcement learning, and anomaly detection. Connects **Sections 2 and 3**, bridging ML methods with real-time synchronization infrastructure.

---

## D. Real-Time Simulation, Synchronization, and Edge Communication

[14] A. M. Law, *Simulation Modeling and Analysis*, 5th ed. New York, NY, USA: McGraw-Hill, 2015, ISBN: 978-0-07-340132-4. [Online]. Available: https://www.mheducation.com/highered/product/simulation-modeling-and-analysis-law.html

> **Annotation:** The standard graduate-level textbook for discrete-event simulation, covering time-advance mechanisms, input modeling, output analysis, and variance reduction. Chapter 1 defines the DES paradigm that underpins soft real-time wind turbine step-through simulations. Required background for **Section 3** before students work with continuous and hybrid simulation approaches.

[15] OPC Foundation, "OPC Unified Architecture," White Paper, OPC Foundation, 2009, rev. 2025. [Online]. Available: https://opcfoundation.org/opcua-en.pdf

> **Annotation:** Defines OPC Unified Architecture (OPC UA), the IEC 62541 standard for platform-independent, secure, and semantic industrial data exchange. OPC UA enables the data acquisition layer of a wind turbine DT, mapping SCADA tag names to standardized information models. Required reading for **Section 3** on DT connectivity and for understanding IEC 61400-25 communication mappings.

[16] IEC, "Wind Energy Generation Systems — Part 25-1: Communications for Monitoring and Control of Wind Power Plants — Overall Description of Principles and Models," IEC 61400-25-1, ed. 2, 2017. [Online]. Available: https://webstore.iec.ch/en/publication/5438

> **Annotation:** The wind-industry communication standard that specifies the information models, object naming, and protocol mappings for SCADA systems at wind power plants. Part 25-1 establishes the logical node (LN) structure used by SCADA vendors including Greenbyte. Directly governs the signal naming scheme in the Kelmarsh/Penmanshiel datasets; essential for **Sections 3 and 4**.

[17] HiveMQ, "MQTT vs. Kafka: Friends, Not Foes, in the World of Real-Time IoT Data Processing," HiveMQ White Paper, 2024. [Online]. Available: https://www.hivemq.com/blog/mqtt-vs-kafka-real-time-bidirectional-data-processing/

> **Annotation:** Explains the complementary roles of MQTT (lightweight device-level publish/subscribe) and Apache Kafka (durable high-throughput stream broker) in industrial IoT pipelines, with manufacturing use cases. For a wind turbine DT, MQTT ingests raw sensor packets from the nacelle controller while Kafka serves as the event backbone for downstream analytics. Supports **Section 3** architecture discussions on real-time data pipelines.

[18] EMQX / HiveMQ, "Leveraging Streaming Data with MQTT and Kafka," White Paper, Hannover Messe, 2023. [Online]. Available: https://www.hannovermesse.de/apollo/hannover_messe_2024/obs/Binary/A1334907/leveraging-streaming-data-with-mqtt-and-kafka.pdf

> **Annotation:** Detailed technical white paper on integrating MQTT brokers with Kafka clusters for IIoT, covering QoS guarantees, topic routing, schema registry, and latency budgets. Provides concrete architecture patterns for sub-second sensor ingestion in predictive maintenance contexts. Directly applicable to the DT edge-to-cloud data pipeline in **Sections 3 and 4**.

---

## E. Wind Turbine Digital Twins — Domain-Specific

[19] K. Sivalingam, M. Sepulveda, M. Spring, and P. Davies, "A Review and Methodology Development for Remaining Useful Life Prediction of Offshore Fixed and Floating Wind Turbine Power Converter with Digital Twin Technology Perspective," in *Proc. 2nd Int. Conf. on Green Energy and Applications (ICGEA)*, Singapore, Mar. 2018, pp. 197–204. [Online]. Available: https://www.semanticscholar.org/paper/A-Review-and-Methodology-Development-for-Remaining-Sivalingam-Sepulveda/01442f87fc4833a5f09c504c4ad50f7f9bc43d7c

> **Annotation:** Proposes a DT-based methodology for predicting the remaining useful life (RUL) of offshore wind turbine power converters subject to harsh thermal cycling. Combines physics-based degradation models with a DT framework for diagnostic and prognostic health monitoring under offshore operating conditions. One of the earliest domain-specific wind turbine DT papers and a key reference for **Sections 1 and 4**.

[20] J. Tautz-Weinert and S. J. Watson, "Using SCADA Data for Wind Turbine Condition Monitoring — A Review," *IET Renewable Power Gener.*, vol. 11, no. 4, pp. 382–394, Mar. 2017, doi: 10.1049/iet-rpg.2016.0248. [Online]. Available: https://ietresearch.onlinelibrary.wiley.com/doi/10.1049/iet-rpg.2016.0248

> **Annotation:** Surveys the state of the art in SCADA-based condition monitoring across five approach categories—trending, clustering, normal-behaviour modelling, damage modelling, and expert systems—with case studies showing failures detected weeks to months in advance. Validates that 10-minute mean SCADA signals are sufficient for power-curve-based health monitoring. Essential for **Sections 3 and 4** and for justifying the Kelmarsh dataset selection.

[21] O. O. Olatunji, P. A. Adedeji, N. Madushele, and T. C. Jen, "Overview of Digital Twin Technology in Wind Turbine Fault Diagnosis and Condition Monitoring," in *Proc. IEEE 12th Int. Conf. Mechanical and Intelligent Manufacturing Technologies (ICMIMT)*, Cape Town, South Africa, 2021, pp. 201–207. [Online]. Available: https://www.semanticscholar.org/paper/Overview-of-Digital-Twin-Technology-in-Wind-Turbine-Olatunji-Adedeji/7ced5a872c0275d6877a2ee874756425a0997ec0

> **Annotation:** Reviews DT architectures specifically for wind turbine fault diagnosis, categorizing approaches by physics-based, data-driven, and hybrid models. Surveys enabling technologies including IoT, cloud, and AI layers and identifies open challenges around data quality, real-time synchronization, and model uncertainty. Directly motivates the design choices in **Section 4**.

[22] Y. Marykovskiy, T. Clark, J. Deparday, E. Chatzi, and S. Barber, "Architecting a Digital Twin for Wind Turbine Rotor Blade Aerodynamic Monitoring," *Front. Energy Res.*, vol. 12, p. 1428387, Nov. 2024, doi: 10.3389/fenrg.2024.1428387. [Online]. Available: https://www.frontiersin.org/journals/energy-research/articles/10.3389/fenrg.2024.1428387/full

> **Annotation:** Presents the Aerosense digital twin—a "Digital Shadow"-type twin for blade aerodynamic monitoring—as a systems engineering problem using design patterns and co-design. Details architecture from MEMS sensor hardware through cloud API to simulation services. Demonstrates a real-world DT instance aligned with the 5D model, and is a practical exemplar for **Section 4** system design.

[23] NREL, *OpenFAST v3.x Documentation*, National Renewable Energy Laboratory, Golden, CO, 2023. [Online]. Available: https://openfast.readthedocs.io

> **Annotation:** OpenFAST is NREL's open-source, multi-physics, multi-fidelity wind turbine simulation tool (successor to FAST v8). It provides coupled aerodynamic–structural–control simulations that serve as the physics baseline for a DT. Used to generate synthetic training data and validate surrogate predictions. The primary physics simulation reference for **Sections 3 and 4**.

[24] IEC, "Wind Energy Generation Systems — Part 25-6: Communications for Monitoring and Control of Wind Power Plants — Logical Node Classes and Data Classes for Condition Monitoring," IEC 61400-25-6, ed. 1, Dec. 2016. [Online]. Available: https://webstore.iec.ch/en/publication/32580

> **Annotation:** Specifies the information models and data exchange protocols for condition monitoring signals in wind power plants, defining logical node classes for temperature, vibration, and electrical measurements. Provides the semantic layer connecting raw SCADA tags to standardized condition monitoring objects. Supports **Sections 3 and 4** for data model design.

---

## F. Public Datasets

[25] C. Plumley, "Kelmarsh Wind Farm Data," Zenodo, 2022 (updated 2023), doi: 10.5281/zenodo.5841833. [Online]. Available: https://zenodo.org/records/5841834

> **Annotation:** Open dataset (CC-BY-4.0) containing 10-minute SCADA data from six Senvion MM92 turbines (rated 2 MW, 92 m rotor diameter) at Kelmarsh, UK, covering 2016 to mid-2021. Includes ~110 variables per turbine: wind speed (avg/stdev/min/max), active power, rotor speed, blade pitch angles A/B/C, nacelle temperature, generator bearing temperatures, gearbox oil temperatures, and grid meter data. The primary dataset for the Aperture prototype in **Section 4**; see `dataset_schema.md` for full column mapping.

[26] C. Plumley, "Penmanshiel Wind Farm Data," Zenodo, 2022 (updated 2023), doi: 10.5281/zenodo.5946807. [Online]. Available: https://zenodo.org/records/5946808

> **Annotation:** Open dataset (CC-BY-4.0) of 10-minute SCADA data from 14 Senvion MM82 turbines (rated 2 MW, 82 m rotor diameter) at Penmanshiel, UK, covering 2016 to mid-2021. Shares the same Greenbyte secondary SCADA format as Kelmarsh, enabling cross-farm transfer learning experiments. A complementary dataset for **Section 4** validation or multi-farm generalization studies.

[27] C. Draxl, A. Clifton, B.-M. Hodge, and J. McCaa, "The Wind Integration National Dataset (WIND) Toolkit," *Appl. Energy*, vol. 151, pp. 355–366, 2015, doi: 10.1016/j.apenergy.2015.03.038. [Online]. Available: https://www.sciencedirect.com/science/article/abs/pii/S0306261915004237

> **Annotation:** Describes the WIND Toolkit, the largest publicly available mesoscale wind resource dataset—7 years (2007–2013), 126,000+ US sites, 5-minute resolution, 2-km grid. Provides meteorological boundary conditions (wind speed/direction at 100 m, temperature, pressure, air density, capacity factors) for multi-site DT generalization studies. Supports **Sections 3 and 4** for scenario generation and meteorological context.

[28] EDP, "EDP Open Data — Wind Farm Datasets," 2018. [Online]. Available: https://edp.com/en/innovation/data

> **Annotation:** EDP's open-data portal provides SCADA data from multiple wind farms including turbine operational records from 2016–2017 (operational status, active/reactive power, wind speed, pitch angle, yaw) and meteorological mast measurements, under CC-BY-SA license. Useful for supervised fault classification because the dataset includes labeled failure events, supporting anomaly detection experiments in **Section 4**.

---

## G. DT Open-Source Frameworks and Industry Tools

[29] J. Robles, C. Martín, and M. Díaz, "OpenTwins: An Open-Source Framework for the Development of Next-Gen Compositional Digital Twins," *Comput. Ind.*, vol. 152, p. 104007, 2023, doi: 10.1016/j.compind.2023.104007. [Online]. Available: https://github.com/ertis-research/opentwins

> **Annotation:** Presents OpenTwins, developed by the ERTIS group at the University of Málaga, as an open-source compositional DT platform built on Eclipse Ditto, Grafana, and Kubernetes. Supports real-time state monitoring, simulation injection (via FMI/FMU), and ML/AI integration. The most relevant open-source framework for the Aperture prototype's backend in **Section 4**.

[30] S. Infante, C. Martín, J. Robles, et al., "Integrating FMI and ML/AI Models on the Open-Source Digital Twin Framework OpenTwins," *Softw. Pract. Exper.*, 2024, doi: 10.1002/spe.3322.

> **Annotation:** Follow-on paper demonstrating how to integrate FMI-compliant simulation models (e.g., OpenFAST compiled as FMU) and ML/AI surrogate models into the OpenTwins platform. Provides a concrete architecture for combining physics-based and data-driven models in a single DT—directly applicable to the Aperture hybrid DT design in **Sections 2 and 4**.

[31] Eclipse Foundation, "Eclipse Ditto — A Digital Twin Framework," Eclipse Ditto Documentation, 2023. [Online]. Available: https://eclipse.dev/ditto/intro-digitaltwins.html

> **Annotation:** Eclipse Ditto provides the open-source core for managing digital twin state as device shadows, exposing REST and WebSocket APIs, and enforcing policy-based access control. It is the DT management layer underlying OpenTwins and many industrial IoT platforms. Relevant to **Sections 3 and 4** for understanding DT state persistence and API design.

[32] Microsoft, "Azure Digital Twins Overview," Microsoft Learn, 2025. [Online]. Available: https://learn.microsoft.com/en-us/azure/digital-twins/overview

> **Annotation:** Azure Digital Twins is a PaaS offering for creating enterprise-scale twin graphs based on DTDL (Digital Twin Definition Language), with native integration to Azure IoT Hub, Azure Stream Analytics, and 3D Scenes Studio for visualization. Represents the commercial cloud-native DT deployment pattern discussed in **Section 4** for production-grade wind farm DTs.

[33] NVIDIA, "NVIDIA Omniverse — Industrial Metaverse and Digital Twin Platform," NVIDIA Developer Documentation, 2024. [Online]. Available: https://developer.nvidia.com/omniverse

> **Annotation:** NVIDIA Omniverse provides a USD-based real-time 3D collaboration and simulation platform used by Siemens, BMW, and wind energy operators for photorealistic DT visualization and physics simulation. Its Isaac Sim module supports GPU-accelerated aeroelastic simulations. Relevant to **Section 4** for discussing high-fidelity visualization layers in advanced wind turbine DTs.

---

## H. Evaluation Methodology for DT / ML Models

[34] R. J. Hyndman and G. Athanasopoulos, *Forecasting: Principles and Practice*, 3rd ed. Melbourne, Australia: OTexts, 2021. [Online]. Available: https://otexts.com/fpp3/

> **Annotation:** The standard open-access textbook for time series forecasting, covering ARIMA, exponential smoothing, neural networks, and ensemble methods with full Python/R code examples. Chapter 5.10 defines time series cross-validation (rolling forecasting origin / walk-forward validation) as the correct evaluation methodology for sequential data—required for the train/test split strategy in **Section 2**.

[35] T. G. Dietterich, "Ensemble Methods in Machine Learning," in *Multiple Classifier Systems*, Lecture Notes in Computer Science, vol. 1857, Springer, Berlin, 2000, pp. 1–15, doi: 10.1007/3-540-45014-9_1.

> **Annotation:** Classic survey on ensemble learning covering bagging, boosting, and stacking, with theoretical foundations for bias–variance decomposition. Provides the justification for combining surrogate models (e.g., SVR + gradient boosting) in the DT prediction pipeline. Supports metric benchmarking in **Section 2** by establishing the relative strengths of single vs. ensemble estimators.

[36] S. S. Wilks, *Mathematical Statistics*. New York, NY, USA: John Wiley & Sons, 1962; and C. J. Willmott and K. Matsuura, "Advantages of the Mean Absolute Error (MAE) Over the Root Mean Square Error (RMSE) in Assessing Average Model Performance," *Clim. Res.*, vol. 30, no. 1, pp. 79–82, 2005, doi: 10.3354/cr030079. [Online]. Available: https://www.int-res.com/abstracts/cr/v30/n1/p79-82/

> **Annotation:** Willmott and Matsuura's paper is the primary reference for justifying MAE over RMSE when the goal is average model performance assessment, noting that RMSE overweights large errors and is scale-dependent. Together with standard references for MAPE and R², this citation underpins the metric selection (RMSE, MAE, MAPE, R², F1) in the Aperture evaluation framework for **Sections 2 and 4**.

[37] J. Davis and M. Goadrich, "The Relationship Between Precision-Recall and ROC Curves," in *Proc. 23rd Int. Conf. Machine Learning (ICML)*, Pittsburgh, PA, USA, 2006, pp. 233–240, doi: 10.1145/1143844.1143874.

> **Annotation:** Establishes the theoretical relationship between Precision-Recall (PR) curves and Receiver Operating Characteristic (ROC/AUROC) curves, showing that PR AUC is more informative for imbalanced classification problems—critical for fault detection where fault events are rare (<5% of SCADA records). Supports the choice of F1 and AUROC over simple accuracy in the fault classifier evaluation in **Sections 2 and 4**.

---

## Additional Supporting Sources

[38] A. Rasheed, O. San, and T. Kvamsdal, "Digital Twinning of a Hydropower Plant Using Machine Learning: A Norwegian Case Study," in *Proc. IEEE Int. Conf. Big Data*, 2019. [UNVERIFIED — cited as analogous energy DT case study; verify specific conference volume before submission]

> **Annotation (tentative):** Demonstrates a ML-driven DT for a hydropower turbine—an energy domain analogue to wind turbines—showing how normal-behaviour models and anomaly detection transfer across rotating machinery. Included here as a placeholder; replace with a verified DOI from the Norwegian DT energy literature for **Section 4**.

[39] F. Tchakoua, R. Wamkeue, M. Ouhrouche, F. Slaoui-Hasnaoui, T. A. Tameghe, and G. Ekemb, "Wind Turbine Condition Monitoring: State-of-the-Art Review, New Trends, and Future Challenges," *Energies*, vol. 7, no. 4, pp. 2595–2630, 2014, doi: 10.3390/en7042595. [Online]. Available: https://www.mdpi.com/1996-1073/7/4/2595

> **Annotation:** Comprehensive review of wind turbine condition monitoring technologies—vibration analysis, oil analysis, acoustic emission, electrical signal analysis, and SCADA-based approaches—with failure mode analysis for all major drivetrain components. Provides the failure taxonomy that informs the fault class labels used in the Aperture classifier in **Sections 3 and 4**.

[40] M. Schlechtingen and I. F. Santos, "Comparative Analysis of Neural Network and Regression Based Condition Monitoring Approaches for Wind Turbine Fault Detection," *Mech. Syst. Signal Process.*, vol. 25, no. 5, pp. 1849–1875, 2011, doi: 10.1016/j.ymssp.2010.12.007.

> **Annotation:** Early benchmark study comparing ANN, polynomial regression, and SVR as normal-behaviour models for wind turbine generator bearing temperature monitoring using SCADA data. Demonstrates that SVR generalises better than ANNs on small datasets and motivates the inclusion of SVR as a baseline surrogate in the Aperture ML pipeline of **Section 2**.

---

## Datasets Selected for the Prototype

### Recommended Primary Dataset: **Kelmarsh Wind Farm (DOI: 10.5281/zenodo.5841833)**

**Rationale:**
The Kelmarsh dataset is the preferred choice for the Aperture prototype for the following reasons:

1. **Open license (CC-BY-4.0):** Unconditional reuse permitted for academic and commercial purposes without registration.
2. **Rich signal schema (~110 variables):** Covers the full signal suite needed for a multi-output DT—wind resource, mechanical, thermal, and electrical variables at 10-minute mean/stdev/min/max resolution.
3. **Long temporal span (2016–mid 2021, ~5.5 years):** Sufficient for training power-curve surrogates, testing multi-year generalisation, and applying walk-forward time series validation.
4. **Six turbines (same model — Senvion MM92):** Allows within-farm transfer learning and cross-turbine anomaly benchmarking.
5. **Events/alarms file included:** Provides partial fault labels for supervised anomaly detection experiments.
6. **Greenbyte SCADA format:** Column naming follows a consistent secondary SCADA convention documented in the `Kelmarsh_WT_Turbine_dataSignalMapping.xlsx` file.
7. **Penmanshiel is structurally identical** and can serve as a held-out test farm for cross-site generalisation, as both were released together by the same operator (Cubico Sustainable Investments Ltd).

See [`dataset_schema.md`](dataset_schema.md) for the exact column specification.
