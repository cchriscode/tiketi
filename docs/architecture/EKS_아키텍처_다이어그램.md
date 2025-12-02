# EKS 아키텍처 다이어그램

> **티켓팅 서비스에 최적화된 Kubernetes 아키텍처**

## 📐 다이어그램 개요

이 다이어그램은 Docker Compose에서 EKS로 마이그레이션된 티켓팅 서비스의 최종 아키텍처를 보여줍니다.

### 주요 변경 사항

| 항목 | Before (ECS) | After (EKS) |
|-----|-------------|------------|
| **컴퓨팅** | ECS Fargate | EKS Node Group (EC2) |
| **로드 밸런서** | ALB (Application) | NLB (Network) - WebSocket 최적화 |
| **데이터베이스** | Aurora | RDS PostgreSQL Multi-AZ |
| **캐시** | ElastiCache Redis | ElastiCache Redis Cluster (3 shards) |
| **스케일링** | Lambda + CloudWatch Alarms | HPA + Cluster Autoscaler + Metrics Server |
| **모니터링** | CloudWatch | Prometheus + Grafana |
| **Pod 배치** | N/A | Pod Anti-Affinity, Node Affinity |

---

## 🎨 Draw.io XML (mxGraph)

아래 XML을 [draw.io](https://app.diagrams.net/)에 붙여넣어 다이어그램을 확인하세요.

```xml
<mxGraphModel dx="1601" dy="1018" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2800" pageHeight="2200" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />

    <!-- 제목 -->
    <mxCell id="title" value="Tiketi EKS 프로덕션 아키텍처 (Kubernetes)" style="text;strokeColor=none;fillColor=none;html=1;fontSize=24;fontStyle=1;verticalAlign=middle;align=center;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="900" y="20" width="1000" height="50" as="geometry" />
    </mxCell>

    <!-- Route 53 -->
    <mxCell id="r53" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.route_53;" parent="1" vertex="1">
      <mxGeometry x="1360" y="100" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="r53-label" value="Route 53&lt;br&gt;&lt;b&gt;tiketi.gg&lt;/b&gt;" style="text;html=1;fontSize=11;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1410" y="125" width="120" height="30" as="geometry" />
    </mxCell>

    <!-- CloudFront -->
    <mxCell id="cf" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.cloudfront;" parent="1" vertex="1">
      <mxGeometry x="1360" y="280" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="cf-label" value="CloudFront&lt;br&gt;&lt;b&gt;CDN (React)&lt;/b&gt;" style="text;html=1;fontSize=11;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1410" y="305" width="120" height="30" as="geometry" />
    </mxCell>

    <!-- S3 Frontend -->
    <mxCell id="s3-r" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#7AA116;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.s3;" parent="1" vertex="1">
      <mxGeometry x="1080" y="280" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="s3-r-label" value="S3&lt;br&gt;&lt;b&gt;Frontend Build&lt;/b&gt;" style="text;html=1;fontSize=11;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1060" y="365" width="120" height="30" as="geometry" />
    </mxCell>

    <!-- S3 Storage -->
    <mxCell id="s3-s" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#7AA116;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.s3;" parent="1" vertex="1">
      <mxGeometry x="1640" y="280" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="s3-s-label" value="S3&lt;br&gt;&lt;b&gt;Uploads/Assets&lt;/b&gt;" style="text;html=1;fontSize=11;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1620" y="240" width="120" height="30" as="geometry" />
    </mxCell>

    <!-- VPC Background -->
    <mxCell id="vpc-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#EDF6F9;strokeColor=#5A95BC;strokeWidth=2;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="140" y="520" width="2520" height="1600" as="geometry" />
    </mxCell>
    <mxCell id="vpc-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#5A95BC;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.vpc;" parent="1" vertex="1">
      <mxGeometry x="140" y="520" width="40" height="40" as="geometry" />
    </mxCell>
    <mxCell id="vpc-label" value="VPC 10.0.0.0/16 - 서울 리전 (ap-northeast-2)" style="text;html=1;fontSize=12;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="195" y="520" width="400" height="20" as="geometry" />
    </mxCell>

    <!-- Internet Gateway -->
    <mxCell id="igw" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.internet_gateway;" parent="1" vertex="1">
      <mxGeometry x="1360" y="560" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="igw-label" value="Internet Gateway" style="text;html=1;fontSize=11;fontStyle=0;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1340" y="645" width="120" height="30" as="geometry" />
    </mxCell>

    <!-- NLB (Network Load Balancer) -->
    <mxCell id="nlb" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.network_load_balancer;" parent="1" vertex="1">
      <mxGeometry x="1360" y="740" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="nlb-label" value="Network Load Balancer&lt;br&gt;&lt;b&gt;Sticky Session (Source IP)&lt;/b&gt;&lt;br&gt;&lt;font color=&quot;#388E3C&quot;&gt;WebSocket 최적화&lt;/font&gt;" style="text;html=1;fontSize=11;fontStyle=0;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1280" y="825" width="240" height="50" as="geometry" />
    </mxCell>

    <!-- EKS Cluster -->
    <mxCell id="eks-cluster-bg" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF9E6;strokeColor=#FF9900;strokeWidth=3;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="200" y="900" width="2400" height="580" as="geometry" />
    </mxCell>
    <mxCell id="eks-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.eks_cloud;" parent="1" vertex="1">
      <mxGeometry x="200" y="900" width="50" height="50" as="geometry" />
    </mxCell>
    <mxCell id="eks-label" value="EKS Cluster (tiketi-prod-cluster) - Kubernetes 1.28" style="text;html=1;fontSize=13;fontStyle=1;verticalAlign=middle;align=left;fontColor=#FF9900;" parent="1" vertex="1">
      <mxGeometry x="260" y="905" width="450" height="25" as="geometry" />
    </mxCell>

    <!-- Availability Zone A -->
    <mxCell id="az-a-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#F2F8EC;strokeColor=#879E6C;strokeWidth=1;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="240" y="950" width="1100" height="500" as="geometry" />
    </mxCell>
    <mxCell id="az-a-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#879E6C;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.availability_zone;" parent="1" vertex="1">
      <mxGeometry x="240" y="950" width="35" height="35" as="geometry" />
    </mxCell>
    <mxCell id="az-a-label" value="Availability Zone A (ap-northeast-2a)" style="text;html=1;fontSize=12;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="275" y="957.5" width="300" height="20" as="geometry" />
    </mxCell>

    <!-- Public Subnet A -->
    <mxCell id="pub-a-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#E8F4E5;strokeColor=#6CAF5B;strokeWidth=1;" parent="1" vertex="1">
      <mxGeometry x="280" y="1000" width="500" height="120" as="geometry" />
    </mxCell>
    <mxCell id="pub-a-label" value="Public subnet A (10.0.1.0/24)" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="290" y="1005" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="nat-a" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.nat_gateway;" parent="1" vertex="1">
      <mxGeometry x="490" y="1035" width="60" height="60" as="geometry" />
    </mxCell>
    <mxCell id="nat-a-label" value="NAT Gateway A" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;fontStyle=1" parent="1" vertex="1">
      <mxGeometry x="465" y="1100" width="110" height="20" as="geometry" />
    </mxCell>

    <!-- Private Subnet A - Node Group -->
    <mxCell id="priv-a-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#E7F2F8;strokeColor=#5A95BC;strokeWidth=1;" parent="1" vertex="1">
      <mxGeometry x="280" y="1150" width="500" height="270" as="geometry" />
    </mxCell>
    <mxCell id="priv-a-label" value="Private subnet A (10.0.11.0/24) - EKS Node Group" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="290" y="1155" width="350" height="20" as="geometry" />
    </mxCell>

    <!-- Worker Node A1 (On-Demand) -->
    <mxCell id="node-a1-bg" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFACD;strokeColor=#FFB800;strokeWidth=2;" parent="1" vertex="1">
      <mxGeometry x="300" y="1190" width="220" height="210" as="geometry" />
    </mxCell>
    <mxCell id="node-a1-label" value="Worker Node A1&lt;br&gt;&lt;b&gt;t3.medium (On-Demand)&lt;/b&gt;&lt;br&gt;&lt;font size=&quot;1&quot;&gt;2 vCPU, 4GB RAM&lt;/font&gt;" style="text;html=1;fontSize=9;fontStyle=1;verticalAlign=top;align=center;fontColor=#FF9900;" parent="1" vertex="1">
      <mxGeometry x="305" y="1195" width="210" height="40" as="geometry" />
    </mxCell>

    <!-- Backend Pods in Node A1 -->
    <mxCell id="pod-a1-1" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.container_1;" parent="1" vertex="1">
      <mxGeometry x="320" y="1245" width="50" height="50" as="geometry" />
    </mxCell>
    <mxCell id="pod-a1-1-label" value="Pod-1&lt;br&gt;&lt;font size=&quot;1&quot;&gt;500m/1Gi&lt;/font&gt;" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="310" y="1300" width="70" height="25" as="geometry" />
    </mxCell>

    <mxCell id="pod-a1-2" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.container_1;" parent="1" vertex="1">
      <mxGeometry x="430" y="1245" width="50" height="50" as="geometry" />
    </mxCell>
    <mxCell id="pod-a1-2-label" value="Pod-2&lt;br&gt;&lt;font size=&quot;1&quot;&gt;500m/1Gi&lt;/font&gt;" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="420" y="1300" width="70" height="25" as="geometry" />
    </mxCell>

    <mxCell id="pod-a1-3" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.container_1;" parent="1" vertex="1">
      <mxGeometry x="375" y="1335" width="50" height="50" as="geometry" />
    </mxCell>
    <mxCell id="pod-a1-3-label" value="Pod-3&lt;br&gt;&lt;font size=&quot;1&quot;&gt;500m/1Gi&lt;/font&gt;" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="365" y="1390" width="70" height="25" as="geometry" />
    </mxCell>

    <!-- Worker Node A2 (Spot) -->
    <mxCell id="node-a2-bg" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2FF;strokeColor=#4A90E2;strokeWidth=2;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="540" y="1190" width="220" height="210" as="geometry" />
    </mxCell>
    <mxCell id="node-a2-label" value="Worker Node A2&lt;br&gt;&lt;b&gt;t3.medium (Spot)&lt;/b&gt;&lt;br&gt;&lt;font size=&quot;1&quot;&gt;70% 할인&lt;/font&gt;" style="text;html=1;fontSize=9;fontStyle=1;verticalAlign=top;align=center;fontColor=#4A90E2;" parent="1" vertex="1">
      <mxGeometry x="545" y="1195" width="210" height="40" as="geometry" />
    </mxCell>

    <!-- Backend Pods in Node A2 -->
    <mxCell id="pod-a2-1" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.container_1;" parent="1" vertex="1">
      <mxGeometry x="560" y="1245" width="50" height="50" as="geometry" />
    </mxCell>
    <mxCell id="pod-a2-1-label" value="Pod-4&lt;br&gt;&lt;font size=&quot;1&quot;&gt;500m/1Gi&lt;/font&gt;" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="550" y="1300" width="70" height="25" as="geometry" />
    </mxCell>

    <mxCell id="pod-a2-2" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.container_1;" parent="1" vertex="1">
      <mxGeometry x="670" y="1245" width="50" height="50" as="geometry" />
    </mxCell>
    <mxCell id="pod-a2-2-label" value="Pod-5&lt;br&gt;&lt;font size=&quot;1&quot;&gt;500m/1Gi&lt;/font&gt;" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="660" y="1300" width="70" height="25" as="geometry" />
    </mxCell>

    <!-- Availability Zone B -->
    <mxCell id="az-b-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#F2F8EC;strokeColor=#879E6C;strokeWidth=1;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="1460" y="950" width="1100" height="500" as="geometry" />
    </mxCell>
    <mxCell id="az-b-icon" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#879E6C;strokeColor=none;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.availability_zone;" parent="1" vertex="1">
      <mxGeometry x="1460" y="950" width="35" height="35" as="geometry" />
    </mxCell>
    <mxCell id="az-b-label" value="Availability Zone B (ap-northeast-2b)" style="text;html=1;fontSize=12;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="1495" y="957.5" width="300" height="20" as="geometry" />
    </mxCell>

    <!-- Public Subnet B -->
    <mxCell id="pub-b-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#E8F4E5;strokeColor=#6CAF5B;strokeWidth=1;" parent="1" vertex="1">
      <mxGeometry x="2020" y="1000" width="500" height="120" as="geometry" />
    </mxCell>
    <mxCell id="pub-b-label" value="Public subnet B (10.0.2.0/24)" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="2030" y="1005" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="nat-b" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#8C4FFF;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.nat_gateway;" parent="1" vertex="1">
      <mxGeometry x="2230" y="1035" width="60" height="60" as="geometry" />
    </mxCell>
    <mxCell id="nat-b-label" value="NAT Gateway B" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;fontStyle=1" parent="1" vertex="1">
      <mxGeometry x="2205" y="1100" width="110" height="20" as="geometry" />
    </mxCell>

    <!-- Private Subnet B - Node Group -->
    <mxCell id="priv-b-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#E7F2F8;strokeColor=#5A95BC;strokeWidth=1;" parent="1" vertex="1">
      <mxGeometry x="2020" y="1150" width="500" height="270" as="geometry" />
    </mxCell>
    <mxCell id="priv-b-label" value="Private subnet B (10.0.12.0/24) - EKS Node Group" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=middle;align=left;fontColor=#232F3E;" parent="1" vertex="1">
      <mxGeometry x="2030" y="1155" width="350" height="20" as="geometry" />
    </mxCell>

    <!-- Worker Node B1 (On-Demand) -->
    <mxCell id="node-b1-bg" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFACD;strokeColor=#FFB800;strokeWidth=2;" parent="1" vertex="1">
      <mxGeometry x="2040" y="1190" width="220" height="210" as="geometry" />
    </mxCell>
    <mxCell id="node-b1-label" value="Worker Node B1&lt;br&gt;&lt;b&gt;t3.medium (On-Demand)&lt;/b&gt;&lt;br&gt;&lt;font size=&quot;1&quot;&gt;2 vCPU, 4GB RAM&lt;/font&gt;" style="text;html=1;fontSize=9;fontStyle=1;verticalAlign=top;align=center;fontColor=#FF9900;" parent="1" vertex="1">
      <mxGeometry x="2045" y="1195" width="210" height="40" as="geometry" />
    </mxCell>

    <!-- Backend Pods in Node B1 -->
    <mxCell id="pod-b1-1" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.container_1;" parent="1" vertex="1">
      <mxGeometry x="2060" y="1245" width="50" height="50" as="geometry" />
    </mxCell>
    <mxCell id="pod-b1-1-label" value="Pod-6&lt;br&gt;&lt;font size=&quot;1&quot;&gt;500m/1Gi&lt;/font&gt;" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="2050" y="1300" width="70" height="25" as="geometry" />
    </mxCell>

    <mxCell id="pod-b1-2" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.container_1;" parent="1" vertex="1">
      <mxGeometry x="2170" y="1245" width="50" height="50" as="geometry" />
    </mxCell>
    <mxCell id="pod-b1-2-label" value="Pod-7&lt;br&gt;&lt;font size=&quot;1&quot;&gt;500m/1Gi&lt;/font&gt;" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="2160" y="1300" width="70" height="25" as="geometry" />
    </mxCell>

    <!-- Worker Node B2 (Spot) -->
    <mxCell id="node-b2-bg" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2FF;strokeColor=#4A90E2;strokeWidth=2;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="2280" y="1190" width="220" height="210" as="geometry" />
    </mxCell>
    <mxCell id="node-b2-label" value="Worker Node B2&lt;br&gt;&lt;b&gt;t3.medium (Spot)&lt;/b&gt;&lt;br&gt;&lt;font size=&quot;1&quot;&gt;70% 할인&lt;/font&gt;" style="text;html=1;fontSize=9;fontStyle=1;verticalAlign=top;align=center;fontColor=#4A90E2;" parent="1" vertex="1">
      <mxGeometry x="2285" y="1195" width="210" height="40" as="geometry" />
    </mxCell>

    <!-- Backend Pods in Node B2 -->
    <mxCell id="pod-b2-1" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.container_1;" parent="1" vertex="1">
      <mxGeometry x="2300" y="1245" width="50" height="50" as="geometry" />
    </mxCell>
    <mxCell id="pod-b2-1-label" value="Pod-8&lt;br&gt;&lt;font size=&quot;1&quot;&gt;500m/1Gi&lt;/font&gt;" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="2290" y="1300" width="70" height="25" as="geometry" />
    </mxCell>

    <mxCell id="pod-b2-2" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.container_1;" parent="1" vertex="1">
      <mxGeometry x="2410" y="1245" width="50" height="50" as="geometry" />
    </mxCell>
    <mxCell id="pod-b2-2-label" value="Pod-9&lt;br&gt;&lt;font size=&quot;1&quot;&gt;500m/1Gi&lt;/font&gt;" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="2400" y="1300" width="70" height="25" as="geometry" />
    </mxCell>

    <!-- Kubernetes Control Plane -->
    <mxCell id="k8s-control" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFE6CC;strokeColor=#D79B00;strokeWidth=2;" parent="1" vertex="1">
      <mxGeometry x="870" y="1000" width="420" height="140" as="geometry" />
    </mxCell>
    <mxCell id="k8s-control-label" value="Kubernetes Control Plane (Managed by AWS)" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=top;align=center;fontColor=#D79B00;" parent="1" vertex="1">
      <mxGeometry x="880" y="1010" width="400" height="20" as="geometry" />
    </mxCell>

    <mxCell id="k8s-hpa" value="" style="shape=image;html=1;verticalAlign=top;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;imageAspect=0;aspect=fixed;image=https://cdn4.iconfinder.com/data/icons/logos-and-brands/512/189_Kubernetes_logo_logos-128.png" parent="1" vertex="1">
      <mxGeometry x="900" y="1045" width="40" height="40" as="geometry" />
    </mxCell>
    <mxCell id="k8s-hpa-label" value="HPA" style="text;html=1;fontSize=9;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="890" y="1090" width="60" height="20" as="geometry" />
    </mxCell>

    <mxCell id="k8s-ca" value="" style="shape=image;html=1;verticalAlign=top;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;imageAspect=0;aspect=fixed;image=https://cdn4.iconfinder.com/data/icons/logos-and-brands/512/189_Kubernetes_logo_logos-128.png" parent="1" vertex="1">
      <mxGeometry x="1000" y="1045" width="40" height="40" as="geometry" />
    </mxCell>
    <mxCell id="k8s-ca-label" value="Cluster&lt;br&gt;Autoscaler" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="985" y="1090" width="70" height="30" as="geometry" />
    </mxCell>

    <mxCell id="k8s-metrics" value="" style="shape=image;html=1;verticalAlign=top;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;imageAspect=0;aspect=fixed;image=https://cdn4.iconfinder.com/data/icons/logos-and-brands/512/189_Kubernetes_logo_logos-128.png" parent="1" vertex="1">
      <mxGeometry x="1120" y="1045" width="40" height="40" as="geometry" />
    </mxCell>
    <mxCell id="k8s-metrics-label" value="Metrics&lt;br&gt;Server" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1105" y="1090" width="70" height="30" as="geometry" />
    </mxCell>

    <mxCell id="k8s-alb-controller" value="" style="shape=image;html=1;verticalAlign=top;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;imageAspect=0;aspect=fixed;image=https://cdn4.iconfinder.com/data/icons/logos-and-brands/512/189_Kubernetes_logo_logos-128.png" parent="1" vertex="1">
      <mxGeometry x="1220" y="1045" width="40" height="40" as="geometry" />
    </mxCell>
    <mxCell id="k8s-alb-controller-label" value="AWS LB&lt;br&gt;Controller" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1200" y="1090" width="80" height="30" as="geometry" />
    </mxCell>

    <!-- Data Layer -->
    <mxCell id="data-layer-bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#F5EFF8;strokeColor=#9B59B6;strokeWidth=2;" parent="1" vertex="1">
      <mxGeometry x="200" y="1550" width="2400" height="530" as="geometry" />
    </mxCell>
    <mxCell id="data-layer-label" value="Data Layer (Private Subnets)" style="text;html=1;fontSize=12;fontStyle=1;verticalAlign=middle;align=left;fontColor=#9B59B6;" parent="1" vertex="1">
      <mxGeometry x="220" y="1560" width="300" height="25" as="geometry" />
    </mxCell>

    <!-- RDS PostgreSQL Primary -->
    <mxCell id="rds-pri" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.rds_postgresql_instance;" parent="1" vertex="1">
      <mxGeometry x="480" y="1680" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="rds-pri-label" value="RDS PostgreSQL&lt;br&gt;&lt;b&gt;Primary (Multi-AZ)&lt;/b&gt;&lt;br&gt;&lt;font size=&quot;1&quot;&gt;db.r6g.large&lt;/font&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="420" y="1765" width="200" height="45" as="geometry" />
    </mxCell>

    <!-- RDS PostgreSQL Standby -->
    <mxCell id="rds-standby" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.rds_postgresql_instance;" parent="1" vertex="1">
      <mxGeometry x="480" y="1900" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="rds-standby-label" value="RDS PostgreSQL&lt;br&gt;&lt;b&gt;Standby (AZ-B)&lt;/b&gt;&lt;br&gt;&lt;font size=&quot;1&quot;&gt;자동 Failover&lt;/font&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="420" y="1985" width="200" height="45" as="geometry" />
    </mxCell>

    <!-- RDS Read Replica -->
    <mxCell id="rds-replica" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.rds_postgresql_instance_read_replica;" parent="1" vertex="1">
      <mxGeometry x="760" y="1680" width="80" height="80" as="geometry" />
    </mxCell>
    <mxCell id="rds-replica-label" value="RDS PostgreSQL&lt;br&gt;&lt;b&gt;Read Replica&lt;/b&gt;&lt;br&gt;&lt;font size=&quot;1&quot;&gt;읽기 전용&lt;/font&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="700" y="1765" width="200" height="45" as="geometry" />
    </mxCell>

    <!-- ElastiCache Redis Cluster -->
    <mxCell id="redis-bg" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#E74C3C;strokeWidth=2;dashed=1;" parent="1" vertex="1">
      <mxGeometry x="1080" y="1620" width="720" height="420" as="geometry" />
    </mxCell>
    <mxCell id="redis-label" value="ElastiCache Redis Cluster (3 Shards)" style="text;html=1;fontSize=11;fontStyle=1;verticalAlign=top;align=center;fontColor=#E74C3C;" parent="1" vertex="1">
      <mxGeometry x="1090" y="1630" width="700" height="20" as="geometry" />
    </mxCell>

    <!-- Shard 1 -->
    <mxCell id="shard1-primary" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="1120" y="1680" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="shard1-primary-label" value="Shard 1&lt;br&gt;&lt;b&gt;Primary&lt;/b&gt;" style="text;html=1;fontSize=9;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1100" y="1755" width="110" height="30" as="geometry" />
    </mxCell>

    <mxCell id="shard1-replica1" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="1120" y="1830" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="shard1-replica1-label" value="Replica 1" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1105" y="1905" width="100" height="20" as="geometry" />
    </mxCell>

    <mxCell id="shard1-replica2" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="1120" y="1950" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="shard1-replica2-label" value="Replica 2" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1105" y="2025" width="100" height="20" as="geometry" />
    </mxCell>

    <!-- Shard 2 -->
    <mxCell id="shard2-primary" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="1375" y="1680" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="shard2-primary-label" value="Shard 2&lt;br&gt;&lt;b&gt;Primary&lt;/b&gt;" style="text;html=1;fontSize=9;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1355" y="1755" width="110" height="30" as="geometry" />
    </mxCell>

    <mxCell id="shard2-replica1" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="1375" y="1830" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="shard2-replica1-label" value="Replica 1" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1360" y="1905" width="100" height="20" as="geometry" />
    </mxCell>

    <mxCell id="shard2-replica2" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="1375" y="1950" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="shard2-replica2-label" value="Replica 2" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1360" y="2025" width="100" height="20" as="geometry" />
    </mxCell>

    <!-- Shard 3 -->
    <mxCell id="shard3-primary" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="1630" y="1680" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="shard3-primary-label" value="Shard 3&lt;br&gt;&lt;b&gt;Primary&lt;/b&gt;" style="text;html=1;fontSize=9;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1610" y="1755" width="110" height="30" as="geometry" />
    </mxCell>

    <mxCell id="shard3-replica1" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="1630" y="1830" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="shard3-replica1-label" value="Replica 1" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1615" y="1905" width="100" height="20" as="geometry" />
    </mxCell>

    <mxCell id="shard3-replica2" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#C925D1;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elasticache;" parent="1" vertex="1">
      <mxGeometry x="1630" y="1950" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="shard3-replica2-label" value="Replica 2" style="text;html=1;fontSize=8;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="1615" y="2025" width="100" height="20" as="geometry" />
    </mxCell>

    <!-- Monitoring -->
    <mxCell id="prometheus" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#E7157B;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.cloudwatch;" parent="1" vertex="1">
      <mxGeometry x="2040" y="1680" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="prometheus-label" value="Prometheus&lt;br&gt;&lt;b&gt;메트릭 수집&lt;/b&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="2005" y="1755" width="140" height="30" as="geometry" />
    </mxCell>

    <mxCell id="grafana" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#E7157B;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.cloudwatch;" parent="1" vertex="1">
      <mxGeometry x="2040" y="1830" width="70" height="70" as="geometry" />
    </mxCell>
    <mxCell id="grafana-label" value="Grafana&lt;br&gt;&lt;b&gt;대시보드&lt;/b&gt;" style="text;html=1;fontSize=10;verticalAlign=middle;align=center;" parent="1" vertex="1">
      <mxGeometry x="2005" y="1905" width="140" height="30" as="geometry" />
    </mxCell>

    <!-- Connections -->

    <!-- Route53 to CloudFront -->
    <mxCell id="c1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=3;strokeColor=#545B64;" parent="1" source="r53" target="cf" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <!-- CloudFront to S3 -->
    <mxCell id="c2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#7AA116;" parent="1" source="cf" target="s3-r" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <!-- CloudFront to IGW -->
    <mxCell id="c3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=3;strokeColor=#545B64;" parent="1" source="cf" target="igw" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <!-- IGW to NLB -->
    <mxCell id="c4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=3;strokeColor=#545B64;" parent="1" source="igw" target="nlb" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <!-- NLB to Pods -->
    <mxCell id="c5" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;" parent="1" source="nlb" target="pod-a1-1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1400" y="860" />
          <mxPoint x="345" y="860" />
        </Array>
      </mxGeometry>
    </mxCell>

    <mxCell id="c6" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;" parent="1" source="nlb" target="pod-a2-1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1400" y="860" />
          <mxPoint x="585" y="860" />
        </Array>
      </mxGeometry>
    </mxCell>

    <mxCell id="c7" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;" parent="1" source="nlb" target="pod-b1-1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1400" y="860" />
          <mxPoint x="2085" y="860" />
        </Array>
      </mxGeometry>
    </mxCell>

    <mxCell id="c8" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;" parent="1" source="nlb" target="pod-b2-1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="1400" y="860" />
          <mxPoint x="2325" y="860" />
        </Array>
      </mxGeometry>
    </mxCell>

    <!-- Pods to RDS -->
    <mxCell id="c9" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;dashed=1;" parent="1" source="pod-a1-1" target="rds-pri" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="345" y="1520" />
          <mxPoint x="520" y="1520" />
        </Array>
      </mxGeometry>
    </mxCell>

    <!-- Pods to Redis -->
    <mxCell id="c10" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#E74C3C;dashed=1;" parent="1" source="pod-a1-2" target="shard1-primary" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="455" y="1520" />
          <mxPoint x="1155" y="1520" />
        </Array>
      </mxGeometry>
    </mxCell>

    <!-- RDS Replication -->
    <mxCell id="c11" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;dashed=1;dashPattern=4 4;" parent="1" source="rds-pri" target="rds-standby" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <mxCell id="c12" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;dashed=1;dashPattern=4 4;" parent="1" source="rds-pri" target="rds-replica" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <!-- Redis Shards Replication -->
    <mxCell id="c13" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=1;strokeColor=#E74C3C;dashed=1;dashPattern=4 4;" parent="1" source="shard1-primary" target="shard1-replica1" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <mxCell id="c14" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=1;strokeColor=#E74C3C;dashed=1;dashPattern=4 4;" parent="1" source="shard1-replica1" target="shard1-replica2" edge="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>

    <!-- Prometheus monitoring -->
    <mxCell id="c15" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeWidth=2;strokeColor=#E7157B;dashed=1;dashPattern=2 2;" parent="1" source="pod-a1-1" target="prometheus" edge="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="345" y="1540" />
          <mxPoint x="2075" y="1540" />
        </Array>
      </mxGeometry>
    </mxCell>

    <!-- Legend -->
    <mxCell id="legend" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#666666;strokeWidth=2;verticalAlign=top;align=left;fontSize=14;fontStyle=1;" parent="1" vertex="1">
      <mxGeometry x="710" y="180" width="340" height="280" as="geometry" />
    </mxCell>
    <mxCell id="leg-t1" value="EKS 아키텍처 범례" style="text;html=1;fontSize=12;fontStyle=1;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="730" y="205" width="200" height="25" as="geometry" />
    </mxCell>

    <!-- Legend items -->
    <mxCell id="leg1" value="━━━ 사용자 트래픽 (HTTP/WebSocket)" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="235" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l1" style="edgeStyle=none;rounded=0;html=1;strokeWidth=3;strokeColor=#545B64;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="245" as="sourcePoint" />
        <mxPoint x="780" y="245" as="targetPoint" />
      </mxGeometry>
    </mxCell>

    <mxCell id="leg2" value="━━━ NLB → Pods 트래픽" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="260" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l2" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#ED7100;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="270" as="sourcePoint" />
        <mxPoint x="780" y="270" as="targetPoint" />
      </mxGeometry>
    </mxCell>

    <mxCell id="leg3" value="- - - Pods → RDS 연결" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="285" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l3" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;dashed=1;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="295" as="sourcePoint" />
        <mxPoint x="780" y="295" as="targetPoint" />
      </mxGeometry>
    </mxCell>

    <mxCell id="leg4" value="- - - Pods → Redis 연결" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="310" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l4" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#E74C3C;dashed=1;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="320" as="sourcePoint" />
        <mxPoint x="780" y="320" as="targetPoint" />
      </mxGeometry>
    </mxCell>

    <mxCell id="leg5" value="- - - 복제 (Replication)" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="335" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l5" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#C925D1;dashed=1;dashPattern=4 4;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="345" as="sourcePoint" />
        <mxPoint x="780" y="345" as="targetPoint" />
      </mxGeometry>
    </mxCell>

    <mxCell id="leg6" value="- - - Prometheus 메트릭 수집" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="360" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l6" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#E7157B;dashed=1;dashPattern=2 2;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="370" as="sourcePoint" />
        <mxPoint x="780" y="370" as="targetPoint" />
      </mxGeometry>
    </mxCell>

    <mxCell id="leg7" value="━━━ On-Demand Node" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="385" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l7" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#FFB800;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="395" as="sourcePoint" />
        <mxPoint x="780" y="395" as="targetPoint" />
      </mxGeometry>
    </mxCell>

    <mxCell id="leg8" value="- - - Spot Node (70% 할인)" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="410" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l8" style="edgeStyle=none;rounded=0;html=1;strokeWidth=2;strokeColor=#4A90E2;dashed=1;dashPattern=4 4;" parent="1" edge="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="730" y="420" as="sourcePoint" />
        <mxPoint x="780" y="420" as="targetPoint" />
      </mxGeometry>
    </mxCell>

    <mxCell id="leg9" value="▭ Pod (Backend Container)" style="text;html=1;fontSize=10;verticalAlign=middle;align=left;" parent="1" vertex="1">
      <mxGeometry x="790" y="435" width="250" height="20" as="geometry" />
    </mxCell>
    <mxCell id="leg-l9" value="" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#ED7100;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.container_1;" parent="1" vertex="1">
      <mxGeometry x="735" y="430" width="30" height="30" as="geometry" />
    </mxCell>

  </root>
</mxGraphModel>
```

---

## 📊 아키텍처 구성 요소 상세

### 1. **네트워크 계층**
- **Route 53**: DNS 라우팅
- **CloudFront**: React 앱 CDN 배포
- **NLB (Network Load Balancer)**: WebSocket Sticky Session 지원

### 2. **EKS Cluster (Kubernetes)**
- **Control Plane**: AWS 관리형 (HA 보장)
- **Worker Nodes**:
  - On-Demand (t3.medium × 2): 안정적인 워크로드
  - Spot (t3.medium × 0~10): 비용 절감 (70% 할인)
- **Kubernetes 컴포넌트**:
  - HPA (Horizontal Pod Autoscaler)
  - Cluster Autoscaler
  - Metrics Server
  - AWS Load Balancer Controller

### 3. **애플리케이션 계층 (Pods)**
- **Backend Pods**: Node.js + Socket.IO
- **리소스**: CPU 500m (request), 1000m (limit) / Memory 1Gi (request), 2Gi (limit)
- **배치 전략**: Pod Anti-Affinity (분산 배치)
- **최소/최대**: 2~50 replicas (HPA 관리)

### 4. **데이터 계층**
- **RDS PostgreSQL**:
  - Primary (Multi-AZ): 쓰기/읽기
  - Standby (AZ-B): 자동 Failover
  - Read Replica: 읽기 전용 (선택)
- **ElastiCache Redis Cluster**:
  - 3 Shards × 2 Replicas = 9 Nodes
  - 대기열, 세션, 캐시 데이터

### 5. **모니터링**
- **Prometheus**: 메트릭 수집
- **Grafana**: 대시보드
- **CloudWatch**: 로그 및 알람

---

## 🎯 핵심 특징

| 특징 | 설명 |
|-----|------|
| **Multi-AZ 배포** | 2개 AZ에 분산 배치 (고가용성) |
| **Spot Instance** | 70% 비용 절감 |
| **WebSocket 최적화** | NLB Sticky Session |
| **자동 스케일링** | HPA + Cluster Autoscaler |
| **Pod 분산** | Anti-Affinity로 단일 노드 장애 대응 |
| **데이터 복제** | RDS Multi-AZ + Redis Cluster |

---

## 🚀 사용 방법

1. **Draw.io에서 열기**:
   - https://app.diagrams.net/ 접속
   - "Arrange" → "Insert" → "Advanced" → "XML" 선택
   - 위 XML 붙여넣기

2. **편집**:
   - 각 요소 클릭하여 수정 가능
   - 색상, 크기, 위치 조정 가능

3. **내보내기**:
   - File → Export as → PNG/SVG/PDF 선택

---

**작성일**: 2025-12-02
**버전**: 1.0 (EKS 기반)
